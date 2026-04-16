/**
 * Type declarations for d3-force-3d — a drop-in 3D replacement for d3-force.
 * Only the subset used by KnowledgeGraph3D is declared here.
 */
declare module 'd3-force-3d' {
  import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

  export type { SimulationNodeDatum, SimulationLinkDatum };

  export interface Simulation<N extends SimulationNodeDatum> {
    force(name: string, force?: unknown): this;
    alpha(): number;
    alpha(value: number): this;
    alphaDecay(): number;
    alphaDecay(value: number): this;
    alphaTarget(): number;
    alphaTarget(value: number): this;
    velocityDecay(): number;
    velocityDecay(value: number): this;
    on(type: string, listener: (() => void) | null): this;
    stop(): this;
    tick(): this;
    restart(): this;
    nodes(): N[];
    nodes(nodes: N[]): this;
    numDimensions(): number;
    numDimensions(n: number): this;
  }

  export function forceSimulation<N extends SimulationNodeDatum>(
    nodes?: N[],
    numDimensions?: number,
  ): Simulation<N>;

  export interface ManyBodyForce {
    strength(): number;
    strength(value: number | ((d: SimulationNodeDatum, i: number) => number)): ManyBodyForce;
    distanceMax(): number;
    distanceMax(value: number): ManyBodyForce;
    distanceMin(): number;
    distanceMin(value: number): ManyBodyForce;
    theta(): number;
    theta(value: number): ManyBodyForce;
  }
  export function forceManyBody(): ManyBodyForce;

  export interface LinkForce<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>> {
    id(fn: (d: N) => string): LinkForce<N, L>;
    distance(value: number | ((d: L, i: number) => number)): LinkForce<N, L>;
    strength(value: number | ((d: L, i: number) => number)): LinkForce<N, L>;
    links(): L[];
    links(links: L[]): LinkForce<N, L>;
  }
  export function forceLink<N extends SimulationNodeDatum, L extends SimulationLinkDatum<N>>(
    links?: L[],
  ): LinkForce<N, L>;

  export interface CenterForce {
    x(): number;
    x(value: number): CenterForce;
    y(): number;
    y(value: number): CenterForce;
    z(): number;
    z(value: number): CenterForce;
    strength(): number;
    strength(value: number): CenterForce;
  }
  export function forceCenter(x?: number, y?: number, z?: number): CenterForce;

  export interface CollideForce<N extends SimulationNodeDatum> {
    radius(): number | ((d: N) => number);
    radius(value: number | ((d: N) => number)): CollideForce<N>;
    strength(): number;
    strength(value: number): CollideForce<N>;
    iterations(): number;
    iterations(value: number): CollideForce<N>;
  }
  export function forceCollide<N extends SimulationNodeDatum>(): CollideForce<N>;
}
