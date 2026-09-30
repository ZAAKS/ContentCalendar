import fetch from 'node-fetch';
import chalk from 'chalk';
import { createClient, defaultPlugins } from '@hey-api/openapi-ts';

// Generates the typed Management API client in src/api from a running dev site.
// Usage: npm run generate-client (Web17) or npm run generate-client:v18 (Web18); URLs configured in package.json.
// Both editions expose the same operations, so the generated client is identical.
console.log(chalk.green('Generating OpenAPI client...'));

const swaggerUrl = process.argv[2];
if (swaggerUrl === undefined) {
  console.error(chalk.red('ERROR: Missing URL to OpenAPI spec'));
  console.error(`Example: node generate-openapi.js ${chalk.yellow('https://localhost:44330/umbraco/swagger/content-calendar/swagger.json')}`);
  process.exit(1);
}

// Needed to ignore self-signed certificates from running Umbraco on https on localhost
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('Ensure your Umbraco instance is running');
console.log(`Fetching OpenAPI definition from ${chalk.yellow(swaggerUrl)}`);

try {
  const response = await fetch(swaggerUrl);
  if (!response.ok) {
    console.error(chalk.red(`ERROR: OpenAPI spec returned ${response.status} ${response.statusText}`));
    process.exit(1);
  }

  // Fetch once and hand the parsed document to hey-api, so the self-signed cert override applies.
  const spec = await response.json();

  await createClient({
    input: spec,
    output: 'src/api',
    plugins: [
      ...defaultPlugins,
      {
        name: '@hey-api/client-fetch',
        // Resolved relative to the working directory (the project root) in hey-api 0.99.
        runtimeConfigPath: './src/hey-api.ts',
      },
      {
        // hey-api >= 0.99 (required by @umbraco-cms/backoffice 17.7) replaced asClass/classNameBuilder
        // with `operations`. Generates `ContentCalendarService.getMonth(...)`.
        name: '@hey-api/sdk',
        operations: {
          strategy: 'single',
          container: 'class',
          containerName: 'ContentCalendarService',
          methods: 'static',
        },
      },
    ],
  });

  console.log(chalk.green('Client generated in src/api'));
} catch (error) {
  console.error(`ERROR: Failed to generate the client: ${chalk.red(error.message)}`);
  console.error('Is the Web17 (or Web18) site running on the URL configured in package.json?');
  process.exit(1);
}

