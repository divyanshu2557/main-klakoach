import { authorize, type AuthenticatedRequest } from "../../security/auth-flow.js";
import { assertArtisanOwnsResource } from "../../security/rbac.js";

export class ArtisanService {
  async updateProductInventory(request: AuthenticatedRequest, resourceArtisanId: string) {
    authorize(request, "inventory:write");
    assertArtisanOwnsResource({
      role: request.user.role,
      actorArtisanId: request.user.artisanId,
      resourceArtisanId,
    });

    return {
      allowedFields: ["quantity", "reserved", "lowStockAt"],
      forbiddenFields: ["order", "buyer", "revenue", "platformAnalytics", "otherArtisanData"],
    };
  }

  async uploadProductMedia(request: AuthenticatedRequest, resourceArtisanId: string) {
    authorize(request, "media:write");
    assertArtisanOwnsResource({
      role: request.user.role,
      actorArtisanId: request.user.artisanId,
      resourceArtisanId,
    });

    return {
      storage: "signed object-storage upload URL",
      moderation: "queued for visual safety and product quality review",
    };
  }
}