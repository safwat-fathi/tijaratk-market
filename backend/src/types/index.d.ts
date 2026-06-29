declare global {
  namespace Express {
    interface User {
      id: string;
      userId?: number;
      email?: string;
      facebookId: string;
      first_name?: string;
      last_name?: string;
      tenant_id?: number;
    }

    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export {};
