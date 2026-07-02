import { ContentRepository } from "../repositories/content.repository";

export class ContentService {
  constructor(private readonly contentRepository: ContentRepository) {}

  async getBootstrap() {
    return this.contentRepository.getDashboardContent();
  }
}
