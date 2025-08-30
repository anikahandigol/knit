import { DatabaseService } from "./database"
import { UtilsService } from "./utils"

export class ApiService {
  private db: DatabaseService
  private utils: UtilsService

  constructor() {
    this.db = new DatabaseService()
    this.utils = new UtilsService()
  }

  async initialize() {
    await this.db.connect()
    console.log("API service initialized")
  }

  async handleRequest(request: any) {
    const processedRequest = this.utils.processRequest(request)
    return this.db.findUser(processedRequest.username, processedRequest.password)
  }
}
