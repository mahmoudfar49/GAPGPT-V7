// ============================================================
// FILE: src/types/ServiceTypes.v10.0.0.ts
// VERSION: v10.0.0
// COMMIT: 10 (Service Layer Foundation)
// STATUS: FROZEN 🟢
// ============================================================

export enum ServiceLifetime {
  Singleton = 'Singleton',
  Transient = 'Transient',
  Scoped = 'Scoped' // Placeholder: currently behaves identically to Transient
}

export class ServiceToken<T> {
  constructor(public readonly name: string) {}
}

export type Factory<T> = (resolver: IServiceResolver) => T;
export type Constructor<T> = new (...args: any[]) => T;

export interface IServiceResolver {
  resolve<T>(token: ServiceToken<T>): T;
  tryResolve<T>(token: ServiceToken<T>): T | undefined;
  has(token: ServiceToken<unknown>): boolean;
}

export interface IServiceContainer extends IServiceResolver {
  register<T>(
    token: ServiceToken<T>,
    factory: Factory<T>,
    lifetime?: ServiceLifetime,
    dependencies?: readonly ServiceToken<unknown>[]
  ): void;
  createScope(): IServiceContainer;
  dispose(): Promise<void>;
}
