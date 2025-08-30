export class ConfigService {
  private config = {
    database: {
      host: "localhost",
      port: 5432,
      name: "myapp",
    },
    auth: {
      tokenExpiry: 3600,
      secretKey: "your-secret-key",
    },
  }

  get(key: string) {
    return this.config[key as keyof typeof this.config]
  }

  set(key: string, value: any) {
    ;(this.config as any)[key] = value
  }
}
