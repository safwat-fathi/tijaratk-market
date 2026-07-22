import HttpService from "@/services/base/http.service";
import type {
  CheckoutStorefrontCartDraftInput,
  SaveStorefrontCartDraftInput,
  StorefrontCartDraftResponse,
  StorefrontCheckoutOrder,
} from "@/types/models/storefront-cart-draft";

const tokenHeaders = (token?: string): HeadersInit =>
  token ? { "X-Storefront-Cart-Token": token } : {};

class StorefrontCartDraftsService extends HttpService {
  constructor() {
    super("/storefront-cart-drafts");
  }

  /** Reads an anonymous cart without exposing its opaque token to a client component. */
  public async getDraft(tenantSlug: string, token?: string) {
    return this.get<StorefrontCartDraftResponse>(tenantSlug, undefined, {
      cache: "no-store",
      headers: tokenHeaders(token),
    });
  }

  /** Replaces the server-owned serializable draft contents. */
  public async saveDraft(
    tenantSlug: string,
    input: SaveStorefrontCartDraftInput,
    token?: string,
  ) {
    return this.put<StorefrontCartDraftResponse>(
      tenantSlug,
      input,
      undefined,
      { cache: "no-store", headers: tokenHeaders(token) },
    );
  }

  /** Uploads a temporary pharmacy prescription. */
  public async attachPrescription(
    tenantSlug: string,
    input: FormData,
    token: string,
  ) {
    return this.post<StorefrontCartDraftResponse>(
      `${tenantSlug}/prescription`,
      input,
      undefined,
      { cache: "no-store", headers: tokenHeaders(token), timeoutMs: 30_000 },
    );
  }

  /** Removes the draft-owned prescription. */
  public async removePrescription(tenantSlug: string, token: string) {
    return this.delete<StorefrontCartDraftResponse>(
      `${tenantSlug}/prescription`,
      undefined,
      { cache: "no-store", headers: tokenHeaders(token) },
    );
  }

  /** Converts a claimed draft to an order idempotently. */
  public async checkout(
    tenantSlug: string,
    input: CheckoutStorefrontCartDraftInput,
    token: string,
    headers?: HeadersInit,
  ) {
    return this.post<StorefrontCheckoutOrder>(
      `${tenantSlug}/checkout`,
      input,
      undefined,
      {
        cache: "no-store",
        headers: { ...tokenHeaders(token), ...headers },
      },
    );
  }
}

export const storefrontCartDraftsService = new StorefrontCartDraftsService();
