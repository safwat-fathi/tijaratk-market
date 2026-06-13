import HttpService from "@/services/base/http.service";
import { StoresDirectoryLanding } from "@/types/models/stores-directory";

const STORES_DIRECTORY_REVALIDATE_SECONDS = 300;

class StoresDirectoryService extends HttpService {
  constructor() {
    super("/stores");
  }

  public async getLanding() {
    return this.get<StoresDirectoryLanding>("", undefined, {
      next: { revalidate: STORES_DIRECTORY_REVALIDATE_SECONDS },
    });
  }
}

export const storesDirectoryService = new StoresDirectoryService();
