export interface FileLoader<T> {
    accepts(url: string): boolean;
    load(url: string, options?: RequestInit): Promise<T>;
}
