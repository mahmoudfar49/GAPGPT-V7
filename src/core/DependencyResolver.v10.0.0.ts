import { ServiceToken, ServiceLifetime, IServiceContainer } from "../types/ServiceTypes.js";
import { ProviderRegistry } from "./ProviderRegistry.js";

export class DependencyResolver {
  private readonly registry: ProviderRegistry;
  private readonly resolvingStack = new Set<ServiceToken<any>>();

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  public resolve<T>(token: ServiceToken<T>, container: IServiceContainer): T {
    const provider = this.registry.get(token);
    if (!provider) {
      throw new Error(`No provider registered for token '${token.name}'.`);
    }

    if (this.resolvingStack.has(token)) {
      throw new Error(`Circular dependency detected for token '${token.name}'.`);
    }

    if (provider.lifetime === ServiceLifetime.Singleton) {
      // FIX: Use registry's singleton cache (shared across scopes)
      if (!this.registry.hasSingleton(token)) {
        this.resolvingStack.add(token);
        try {
          const instance = provider.resolve(container);
          this.registry.setSingleton(token, instance);
        } finally {
          this.resolvingStack.delete(token);
        }
      }
      return this.registry.getSingleton(token) as T;
    }

    this.resolvingStack.add(token);
    try {
      return provider.resolve(container);
    } finally {
      this.resolvingStack.delete(token);
    }
  }

  public tryResolve<T>(token: ServiceToken<T>, container: IServiceContainer): T | undefined {
    try {
      return this.resolve(token, container);
    } catch {
      return undefined;
    }
  }

  public has(token: ServiceToken<any>): boolean {
    return this.registry.has(token);
  }

  public clear(): void {
    this.resolvingStack.clear();
  }
}
