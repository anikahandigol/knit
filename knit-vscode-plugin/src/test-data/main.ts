import { AuthService } from "./auth"
import { ApiService } from "./api"
import { Logger } from "./utils"

class Application {
  private authService: AuthService
  private apiService: ApiService
  private logger: Logger

  constructor() {
    this.authService = new AuthService()
    this.apiService = new ApiService()
    this.logger = new Logger()
  }

  async start() {
    this.logger.info("Starting application...")
    await this.authService.initialize()
    await this.apiService.initialize()
    this.logger.info("Application started successfully")
  }
}

export default Application
