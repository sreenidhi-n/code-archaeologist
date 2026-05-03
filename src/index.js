import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';

import { excavateRepo } from './tools/excavateRepo.js';
import { gitHistorian } from './tools/gitHistorian.js';
import { dependencyGrapher } from './tools/dependencyGrapher.js';
import { docsGenerator } from './tools/docsGenerator.js';
import { validateToolArguments, createErrorResponse, createSuccessResponse } from './utils/validation.js';
import { logger } from './utils/logger.js';

const server = new Server(
  { name: 'code-archaeologist', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'excavate_repo',
    description: 'Main entry point. Runs the full 5-phase archaeological excavation on a legacy codebase — reconnaissance, git history, semantic mapping, dependency analysis, and documentation generation.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Absolute path to the local git repository to analyze'
        }
      },
      required: ['repoPath']
    }
  },
  {
    name: 'git_historian',
    description: 'Analyzes git history to surface contributor patterns, bus factor risk, commit timelines, and the human story of who built this codebase and when they left.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Absolute path to the local git repository'
        }
      },
      required: ['repoPath']
    }
  },
  {
    name: 'dependency_grapher',
    description: 'Parses build files (pom.xml, package.json, build.gradle) to extract dependencies, flag outdated versions, detect known CVEs, and calculate a risk score.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Absolute path to the local git repository'
        },
        buildFilePath: {
          type: 'string',
          description: 'Optional: path to specific build file. Auto-detected if omitted.'
        }
      },
      required: ['repoPath']
    }
  },
  {
    name: 'docs_generator',
    description: 'Synthesizes outputs from git_historian and dependency_grapher into a complete excavation report: executive summary, onboarding README, modernization roadmap, and risk heatmap.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Absolute path to the local git repository'
        },
        gitHistorianResult: {
          type: 'object',
          description: 'Output from the git_historian tool'
        },
        dependencyGrapherResult: {
          type: 'object',
          description: 'Output from the dependency_grapher tool'
        }
      },
      required: ['repoPath']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();

  try {
    // Log tool execution start
    logger.toolStart(name, args);

    // Validate arguments
    const validatedArgs = validateToolArguments(name, args);

    // Execute tool
    let result;
    switch (name) {
      case 'excavate_repo':
        result = await excavateRepo(validatedArgs);
        break;
      case 'git_historian':
        result = await gitHistorian(validatedArgs);
        break;
      case 'dependency_grapher':
        result = await dependencyGrapher(validatedArgs);
        break;
      case 'docs_generator':
        result = await docsGenerator(validatedArgs);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Log success
    const duration = Date.now() - startTime;
    logger.toolSuccess(name, duration);

    // Return standardized success response
    const response = createSuccessResponse(result, name);
    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    // Log error
    const duration = Date.now() - startTime;
    logger.toolError(name, error, duration);

    // Return standardized error response
    const errorResponse = createErrorResponse(error, name);
    return {
      content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
      isError: true
    };
  }
});

async function main() {
  try {
    logger.info('Code Archaeologist MCP Server starting...', {
      version: '1.0.0',
      nodeVersion: process.version
    });

    // Log WatsonX routing mode
    const gatewayUrl = process.env.WATSONX_GATEWAY_URL;
    if (gatewayUrl) {
      logger.info('WatsonX routing: Gateway mode (model-agnostic)', {
        gatewayUrl: gatewayUrl
      });
    } else {
      const directUrl = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
      logger.info('WatsonX routing: Direct mode', {
        endpoint: directUrl
      });
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Code Archaeologist MCP Server connected successfully');
  } catch (error) {
    logger.error('Failed to start MCP server', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

main().catch((error) => {
  logger.error('Fatal error in main process', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
