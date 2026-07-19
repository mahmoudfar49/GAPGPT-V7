import {
  ServiceToken,
  ServiceLifetime,
  Factory,
  IServiceContainer,
  IServiceResolver
} from "../types/ServiceTypes.js";

import { IProvider } from "./IProvider.js";
import { ProviderRegistry } from "./ProviderRegistry.js";
import { DependencyResolver } from "./DependencyResolver.js";

class RegisteredProvider<T> implements IProvider<T> {
  constructor(
    public readonly token: ServiceToken<T>,
    public readonly lifetime: ServiceLifetime,
    public readonly dependencies: readonly ServiceToken<unknown>[] | undefined,
    private readonly factory: Factory<T>
  ) {}

  public resolve(resolver: IServiceResolver): T {
    return this.factory(resolver);
  }
}

export class ServiceContainer implements IServiceContainer {
  private registry: ProviderRegistry;
  private resolver: DependencyResolver;

  constructor(parentRegistry?: ProviderRegistry) {
    this.registry = parentRegistry ?? new ProviderRegistry();
    this.resolver = new DependencyResolver(this.registry);
  }

  public register<T>(
    token: ServiceToken<T>,
    factory: Factory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.Transient,
    dependencies?: readonly ServiceToken<unknown>[]
  ): void {
    const provider = new RegisteredProvider(token, lifetime, dependencies, factory);
    this.registry.register(provider);
  }

  public resolve<T>(token: ServiceToken<T>): T {
    return this.resolver.resolve(token, this);
  }

  public tryResolve<T>(token: ServiceToken<T>): T | undefined {
    return this.resolver.tryResolve(token, this);
  }

  public has(token: ServiceToken<unknown>): boolean {
    return this.resolver.has(token);
  }

  public createScope(): IServiceContainer {
    // NOTE: In v10.0.0, this creates a shared-registry view, not an isolated scope.
    return new ServiceContainer(this.registry);
  }

  public async dispose(): Promise<void> {
    // NOTE: In v10.0.0, this acts as a local container reset, not full lifecycle disposal.
    // Existing child containers may still reference the previous shared registry.
    this.registry = new ProviderRegistry();
    this.resolver = new DependencyResolver(this.registry);
  }
}
