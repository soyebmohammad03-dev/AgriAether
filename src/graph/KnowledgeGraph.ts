import type { WorldRegistry } from '../world/WorldRegistry';
import type { Observation } from '../observation/Observation';

/**
 * A lightweight, read-only graph view over entities the WorldRegistry
 * already holds — no new storage, no database. Exists so "what evidence
 * backs this field" or "what's connected to this sensor" can be answered
 * by traversal instead of ad-hoc cross-referencing scattered across the
 * app. Rebuilt on demand from the current WorldRegistry/observation state;
 * never persisted itself.
 */
export type NodeType = 'Farm' | 'Field' | 'Zone' | 'Sensor' | 'CropCycle' | 'Dataset' | 'Observation' | 'Analysis';

export type RelationshipType =
  | 'HAS_FIELD'
  | 'HAS_ZONE'
  | 'DEPLOYED_ON'
  | 'HAS_CROP_CYCLE'
  | 'HAS_DATASET'
  | 'PRODUCED_BY'
  | 'HAS_ANALYSIS'
  | 'EVIDENCE_FROM';

/** Minimal shape any transient analysis result (crop stress, disease/pest risk, ...) needs to appear in the graph — analyses aren't persisted, so this is supplied by the caller each rebuild, same as `observations`. */
export interface AnalysisGraphInput {
  id: string;
  type: string;
  fieldId: string;
  zoneId: string | null;
  computedAt: number;
  supportingObservationIds: string[];
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  timestamp: number | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: RelationshipType;
  provenance: string | null;
}

function nodeId(type: NodeType, id: string): string {
  return `${type}:${id}`;
}

export class KnowledgeGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges: GraphEdge[] = [];
  private readonly outgoing = new Map<string, GraphEdge[]>();
  private readonly incoming = new Map<string, GraphEdge[]>();

  private addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  private addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
    const out = this.outgoing.get(edge.from) ?? [];
    out.push(edge);
    this.outgoing.set(edge.from, out);
    const inc = this.incoming.get(edge.to) ?? [];
    inc.push(edge);
    this.incoming.set(edge.to, inc);
  }

  getNode(id: string): GraphNode | null {
    return this.nodes.get(id) ?? null;
  }

  listNodesOfType(type: NodeType): GraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }

  /** All edges touching `id`, either direction — the basic "what's connected to this" query. */
  neighbors(id: string): GraphEdge[] {
    return [...(this.outgoing.get(id) ?? []), ...(this.incoming.get(id) ?? [])];
  }

  /** Every Observation node reachable from a Field/Zone/Sensor node via DEPLOYED_ON/PRODUCED_BY — the evidence-traversal helper the graph exists for. */
  evidenceFor(id: string): GraphNode[] {
    const result: GraphNode[] = [];
    const visited = new Set<string>([id]);
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of this.neighbors(current)) {
        const otherId = edge.from === current ? edge.to : edge.from;
        if (visited.has(otherId)) continue;
        visited.add(otherId);
        const node = this.nodes.get(otherId);
        if (node?.type === 'Observation') result.push(node);
        else queue.push(otherId);
      }
    }
    return result;
  }

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: Array.from(this.nodes.values()), edges: this.edges };
  }

  /**
   * Builds the graph from the WorldRegistry's currently-loaded entities plus
   * a caller-supplied observation set (the registry itself doesn't hold the
   * full observation history — see App.ts's repositories.observations).
   * Deployment/dataset/observation edges are only added where a real
   * reference already exists; nothing here infers a relationship that
   * isn't already stated on the underlying record.
   */
  static build(
    world: WorldRegistry,
    observations: ReadonlyArray<Observation<unknown>>,
    analyses: ReadonlyArray<AnalysisGraphInput> = []
  ): KnowledgeGraph {
    const graph = new KnowledgeGraph();

    for (const farm of world.listFarms()) {
      graph.addNode({ id: nodeId('Farm', farm.id), type: 'Farm', label: farm.name, timestamp: farm.createdAt });
      for (const field of world.listFieldsForFarm(farm.id)) {
        graph.addNode({ id: nodeId('Field', field.id), type: 'Field', label: field.name, timestamp: field.createdAt });
        graph.addEdge({ from: nodeId('Farm', farm.id), to: nodeId('Field', field.id), type: 'HAS_FIELD', provenance: null });

        for (const zone of world.listZonesForField(field.id)) {
          graph.addNode({ id: nodeId('Zone', zone.id), type: 'Zone', label: zone.name, timestamp: zone.createdAt });
          graph.addEdge({ from: nodeId('Field', field.id), to: nodeId('Zone', zone.id), type: 'HAS_ZONE', provenance: zone.classification });

          for (const deployment of world.listDeploymentsFor({ kind: 'zone', id: zone.id })) {
            const sensor = world.listSensors().find((s) => s.id === deployment.sensorId);
            if (!sensor) continue;
            graph.addNode({ id: nodeId('Sensor', sensor.id), type: 'Sensor', label: sensor.name, timestamp: deployment.deployedAt });
            graph.addEdge({ from: nodeId('Sensor', sensor.id), to: nodeId('Zone', zone.id), type: 'DEPLOYED_ON', provenance: deployment.status });
          }
        }

        for (const deployment of world.listDeploymentsFor({ kind: 'field', id: field.id })) {
          const sensor = world.listSensors().find((s) => s.id === deployment.sensorId);
          if (!sensor) continue;
          graph.addNode({ id: nodeId('Sensor', sensor.id), type: 'Sensor', label: sensor.name, timestamp: deployment.deployedAt });
          graph.addEdge({ from: nodeId('Sensor', sensor.id), to: nodeId('Field', field.id), type: 'DEPLOYED_ON', provenance: deployment.status });
        }

        for (const cropCycle of world.listCropCyclesForField(field.id)) {
          const label = cropCycle.cropTypeId ?? 'unknown crop type';
          graph.addNode({ id: nodeId('CropCycle', cropCycle.id), type: 'CropCycle', label, timestamp: cropCycle.plantingDate });
          graph.addEdge({ from: nodeId('Field', field.id), to: nodeId('CropCycle', cropCycle.id), type: 'HAS_CROP_CYCLE', provenance: cropCycle.source });
        }

        for (const dataset of world.listDatasetsForField(field.id)) {
          graph.addNode({ id: nodeId('Dataset', dataset.id), type: 'Dataset', label: dataset.name, timestamp: dataset.createdAt });
          graph.addEdge({ from: nodeId('Field', field.id), to: nodeId('Dataset', dataset.id), type: 'HAS_DATASET', provenance: dataset.provenance });
        }

        for (const obs of observations) {
          if (obs.fieldId !== field.id || obs.zoneId) continue;
          const id = nodeId('Observation', obs.id);
          if (graph.getNode(id)) continue;
          graph.addNode({ id, type: 'Observation', label: obs.type, timestamp: obs.timestamp });
          graph.addEdge({ from: id, to: nodeId('Field', field.id), type: 'PRODUCED_BY', provenance: obs.provenance });
        }
      }
    }

    for (const obs of observations) {
      if (!obs.zoneId) continue;
      const zoneNodeId = nodeId('Zone', obs.zoneId);
      if (!graph.getNode(zoneNodeId)) continue;
      const id = nodeId('Observation', obs.id);
      if (graph.getNode(id)) continue;
      graph.addNode({ id, type: 'Observation', label: obs.type, timestamp: obs.timestamp });
      graph.addEdge({ from: id, to: zoneNodeId, type: 'PRODUCED_BY', provenance: obs.provenance });
    }

    for (const analysis of analyses) {
      const fieldNodeId = nodeId('Field', analysis.fieldId);
      if (!graph.getNode(fieldNodeId)) continue;
      const id = nodeId('Analysis', analysis.id);
      graph.addNode({ id, type: 'Analysis', label: analysis.type, timestamp: analysis.computedAt });
      graph.addEdge({ from: fieldNodeId, to: id, type: 'HAS_ANALYSIS', provenance: analysis.type });
      for (const obsId of analysis.supportingObservationIds) {
        const obsNodeId = nodeId('Observation', obsId);
        if (!graph.getNode(obsNodeId)) continue;
        graph.addEdge({ from: id, to: obsNodeId, type: 'EVIDENCE_FROM', provenance: null });
      }
    }

    return graph;
  }
}
