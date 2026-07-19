import { ServiceToken } from "../types/ServiceTypes.js";
import { IProvider } from "./IProvider.js";

export class ProviderRegistry {
  private readonly providers = new Map<ServiceToken<any>, IProvider<any>>();
  // FIX: Singleton cache moved here to be shared across scopes
  private readonly singletonCache = new Map<ServiceToken<any>, any>();

  public register<T>(provider: IProvider<T>): void {
    if (this.providers.has(provider.token)) {
      throw new Error(`Duplicate registration: Service with token '${provider.token.name}' is already registered.`);
    }
    this.providers.set(provider.token, provider);
  }

  public get<T>(token: ServiceToken<T>): IProvider<T> | undefined {
    return this.providers.get(token) as IProvider<T> | undefined;
  }

  public has(token: ServiceToken<any>): boolean {
    return this.providers.has(token);
  }

  public getSingleton<T>(token: ServiceToken<T>): T | undefined {
    return this.singletonCache.get(token) as T | undefined;
  }

  public setSingleton<T>(token: ServiceToken<T>, instance: T): void {
    this.singletonCache.set(token, instance);
  }

  public hasSingleton(token: ServiceToken<any>): boolean {
    return this.singletonCache.has(token);
  }

  public clear(): void {
    this.providers.clear();
    this.singletonCache.clear();
  }
}
