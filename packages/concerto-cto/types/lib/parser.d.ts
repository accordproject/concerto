declare function peg$SyntaxError(message: any, expected: any, found: any, location: any): any;
declare class peg$SyntaxError {
    constructor(message: any, expected: any, found: any, location: any);
    format(sources: any): string;
}
declare namespace peg$SyntaxError {
    function buildMessage(expected: any, found: any): string;
}
declare function peg$parse(input: any, options: any): any;
export { peg$SyntaxError as SyntaxError, peg$parse as parse };
