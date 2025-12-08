import { resolveRulesetPath } from '../../src/config-loader';
import findUp from 'find-up';

// Mock the find-up module
jest.mock('find-up');
const mockFindUp = findUp as jest.MockedFunction<typeof findUp>;

describe('resolveRulesetPath', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindUp.mockReset();
    });


    it('should return the provided path when rulesetOption is a custom path', async () => {
        const customPath = '/path/to/custom/ruleset.yaml';
        const result = await resolveRulesetPath(customPath);
        expect(result).toBe(customPath);
        expect(mockFindUp).not.toHaveBeenCalled();
    });

    it('should search for local ruleset when no rulesetOption is provided', async () => {
        const foundPath = '/project/.spectral.yaml';
        mockFindUp
            .mockResolvedValueOnce(foundPath) // First file found
            .mockResolvedValueOnce(undefined) // Subsequent calls return undefined
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);

        const result = await resolveRulesetPath();

        expect(result).toBe(foundPath);
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.yaml');
        expect(mockFindUp).toHaveBeenCalledTimes(1);
    });

    it('should try all ruleset files in order when searching locally', async () => {
        const foundPath = '/project/.spectral.json';
        mockFindUp
            .mockResolvedValueOnce(undefined) // .spectral.yaml not found
            .mockResolvedValueOnce(undefined) // .spectral.yml not found
            .mockResolvedValueOnce(foundPath)  // .spectral.json found
            .mockResolvedValueOnce(undefined); // .spectral.js not called

        const result = await resolveRulesetPath();

        expect(result).toBe(foundPath);
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.yaml');
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.yml');
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.json');
        expect(mockFindUp).toHaveBeenCalledTimes(3);
    });

    it('should return null when no local ruleset files are found', async () => {
        mockFindUp.mockResolvedValue(undefined);

        const result = await resolveRulesetPath();

        expect(result).toBeNull();
        expect(mockFindUp).toHaveBeenCalledTimes(4); // All 4 files checked
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.yaml');
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.yml');
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.json');
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.js');
    });

    it('should handle empty string as rulesetOption', async () => {
        const foundPath = '/project/.spectral.yaml';
        mockFindUp.mockResolvedValueOnce(foundPath);

        const result = await resolveRulesetPath('');

        expect(result).toBe(foundPath);
        expect(mockFindUp).toHaveBeenCalledWith('.spectral.yaml');
    });
});