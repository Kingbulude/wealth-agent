declare module 'bcryptjs' {
  export function hash(data: string, saltRounds: number): Promise<string>
  export function compare(data: string, encrypted: string): Promise<boolean>
  export function genSaltSync(rounds?: number): string
  export function hashSync(data: string, saltRounds?: number): string
}