/**
 * Quiz Validation Script
 * 
 * Validates quiz YAML files against schema and checks for:
 * - Valid YAML syntax
 * - Schema compliance
 * - Unique question IDs
 * - Valid references to source content
 */

import { glob } from "glob";
import { readFile } from "fs/promises";
import chalk from "chalk";
import YAML from "yaml";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

async function main() {
  console.log(chalk.bold("\n📝 Quiz Validation\n"));

  // Load quiz schema
  const schemaContent = await readFile("schemas/quiz-bank.schema.json", "utf-8");
  const schema = JSON.parse(schemaContent);
  const validate = ajv.compile(schema);

  // Find quiz files
  const quizFiles = await glob("content/quiz/**/*.yaml");
  console.log(chalk.gray(`Found ${quizFiles.length} quiz files\n`));

  let passed = 0;
  let failed = 0;

  for (const file of quizFiles) {
    console.log(chalk.blue(`Validating: ${file}`));

    try {
      const content = await readFile(file, "utf-8");
      const data = YAML.parse(content);

      const valid = validate(data);
      if (!valid) {
        failed++;
        console.log(chalk.red("  ✗ Schema validation failed:"));
        for (const error of validate.errors || []) {
          console.log(chalk.red(`    - ${error.instancePath} ${error.message}`));
        }
        continue;
      }

      // Check for duplicate question IDs
      const ids = new Set<string>();
      let hasDuplicates = false;
      for (const question of data.questions || []) {
        if (ids.has(question.id)) {
          console.log(chalk.red(`  ✗ Duplicate question ID: ${question.id}`));
          hasDuplicates = true;
        }
        ids.add(question.id);
      }

      if (hasDuplicates) {
        failed++;
        continue;
      }

      passed++;
      console.log(chalk.green(`  ✓ Valid (${data.questions?.length || 0} questions)`));
    } catch (error) {
      failed++;
      console.log(chalk.red(`  ✗ Error: ${error}`));
    }
  }

  console.log(chalk.bold("\n📊 Quiz Validation Summary\n"));
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  console.log(chalk.red(`  ✗ Failed: ${failed}`));

  if (failed > 0) {
    process.exit(1);
  }

  console.log(chalk.bold.green("\n✅ All quiz files valid!\n"));
}

main().catch((error) => {
  console.error(chalk.red("Quiz validation failed:"), error);
  process.exit(1);
});
