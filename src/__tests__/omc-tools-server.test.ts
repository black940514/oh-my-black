import { describe, it, expect } from 'vitest';
import { ombToolsServer, ombToolNames, getOmbToolNames } from '../mcp/omb-tools-server.js';

describe('omb-tools-server', () => {
  describe('ombToolNames', () => {
    it('should export 18 tools total', () => {
      expect(ombToolNames).toHaveLength(18);
    });

    it('should have 12 LSP tools', () => {
      const lspTools = ombToolNames.filter((n: string) => n.includes('lsp_'));
      expect(lspTools).toHaveLength(12);
    });

    it('should have 2 AST tools', () => {
      const astTools = ombToolNames.filter((n: string) => n.includes('ast_'));
      expect(astTools).toHaveLength(2);
    });

    it('should have python_repl tool', () => {
      expect(ombToolNames).toContain('mcp__t__python_repl');
    });

    it('should use correct MCP naming format', () => {
      ombToolNames.forEach((name: string) => {
        expect(name).toMatch(/^mcp__t__/);
      });
    });
  });

  describe('getOmbToolNames', () => {
    it('should return all tools by default', () => {
      const tools = getOmbToolNames();
      expect(tools).toHaveLength(18);
    });

    it('should filter out LSP tools when includeLsp is false', () => {
      const tools = getOmbToolNames({ includeLsp: false });
      expect(tools.some((t: string) => t.includes('lsp_'))).toBe(false);
      expect(tools).toHaveLength(6); // 2 AST + 1 python + 3 skills
    });

    it('should filter out AST tools when includeAst is false', () => {
      const tools = getOmbToolNames({ includeAst: false });
      expect(tools.some((t: string) => t.includes('ast_'))).toBe(false);
      expect(tools).toHaveLength(16); // 12 LSP + 1 python + 3 skills
    });

    it('should filter out python_repl when includePython is false', () => {
      const tools = getOmbToolNames({ includePython: false });
      expect(tools.some((t: string) => t.includes('python_repl'))).toBe(false);
      expect(tools).toHaveLength(17); // 12 LSP + 2 AST + 3 skills
    });

    it('should filter out skills tools', () => {
      const names = getOmbToolNames({ includeSkills: false });
      expect(names).toHaveLength(15);
      expect(names.every((n: string) => !n.includes('load_omc_skills') && !n.includes('list_omc_skills'))).toBe(true);
    });

    it('should have 3 skills tools', () => {
      const skillsTools = ombToolNames.filter((n: string) => n.includes('load_omc_skills') || n.includes('list_omc_skills'));
      expect(skillsTools).toHaveLength(3);
    });
  });

  describe('ombToolsServer', () => {
    it('should be defined', () => {
      expect(ombToolsServer).toBeDefined();
    });
  });
});
