import { ServiceToken, ServiceLifetime, IServiceResolver } from "../types/ServiceTypes.js";

export interface IProvider<T> {
  readonly token: ServiceToken<T>;
  readonly lifetime: ServiceLifetime;
  
  /**
   * Informational dependency metadata for future validation / graph analysis.
   * In v10.0.0 this is not used for auto-wiring.
   */
  readonly dependencies: readonly ServiceToken<unknown>[] | undefined;

  resolve(resolver: IServiceResolver): T;
}
