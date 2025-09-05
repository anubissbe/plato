/**
 * Test data builders using builder pattern
 */

export class SessionBuilder {
  private session: any = {
    id: 'test-session',
    messages: [],
    model: 'gpt-4',
    provider: 'copilot',
    timestamp: Date.now(),
  };

  withId(id: string): this {
    this.session.id = id;
    return this;
  }

  withMessages(messages: any[]): this {
    this.session.messages = messages;
    return this;
  }

  withModel(model: string): this {
    this.session.model = model;
    return this;
  }

  addMessage(role: string, content: string): this {
    this.session.messages.push({ role, content });
    return this;
  }

  build() {
    return { ...this.session };
  }
}

export class CommandBuilder {
  private command: any = {
    name: '/test',
    summary: 'Test command',
    handler: jest.fn(),
  };

  withName(name: string): this {
    this.command.name = name;
    return this;
  }

  withSummary(summary: string): this {
    this.command.summary = summary;
    return this;
  }

  withHandler(handler: Function): this {
    this.command.handler = handler;
    return this;
  }

  withArgs(args: string[]): this {
    this.command.args = args;
    return this;
  }

  build() {
    return { ...this.command };
  }
}

export class ConfigBuilder {
  private config: any = {
    provider: 'copilot',
    model: 'gpt-4',
    applyMode: 'auto',
  };

  withProvider(provider: string): this {
    this.config.provider = provider;
    return this;
  }

  withModel(model: string): this {
    this.config.model = model;
    return this;
  }

  withApplyMode(mode: 'auto' | 'manual'): this {
    this.config.applyMode = mode;
    return this;
  }

  withPermissions(permissions: any): this {
    this.config.permissions = permissions;
    return this;
  }

  build() {
    return { ...this.config };
  }
}

export class MessageBuilder {
  private message: any = {
    role: 'user',
    content: '',
  };

  asUser(): this {
    this.message.role = 'user';
    return this;
  }

  asAssistant(): this {
    this.message.role = 'assistant';
    return this;
  }

  asSystem(): this {
    this.message.role = 'system';
    return this;
  }

  withContent(content: string): this {
    this.message.content = content;
    return this;
  }

  build() {
    return { ...this.message };
  }
}