import { ConfigService } from "./config"

export class UtilsService {
  private config: ConfigService

  constructor() {
    this.config = new ConfigService()
  }

  processRequest(request: any) {
    return {
      username: request.username?.toLowerCase(),
      password: request.password,
      timestamp: Date.now(),
    }
  }

  formatResponse(data: any) {
    return {
      success: true,
      data,
      timestamp: Date.now(),
    }
  }
}

export class Logger {
  info(message: string) {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`)
  }

  error(message: string) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`)
  }
}
