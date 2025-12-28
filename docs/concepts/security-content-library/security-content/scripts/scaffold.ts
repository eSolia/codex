#!/usr/bin/env tsx
/**
 * Content Scaffolding Script
 * 
 * Creates new content files from templates with interactive prompts.
 * 
 * Usage:
 *   npm run new:issue
 *   npm run new:control
 *   npm run new:concept
 *   npm run new:quiz
 */

import { program } from "commander";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import chalk from "chalk";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question), (answer) => {
      resolve(answer.trim());
    });
  });
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

interface TemplateVars {
  [key: string]: string;
}

function replaceTemplateVars(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(pattern, value);
  }
  return result;
}

async function scaffoldIssue() {
  console.log(chalk.bold("\n📝 New Issue Document\n"));

  const title = await prompt("Issue title (e.g., 'SPF Record Missing'): ");
  const id = toKebabCase(title);
  const subcategory = await prompt("Subcategory (e.g., 'dns/email-authentication'): ");
  const severity = await prompt("Severity (critical/high/medium/low/info): ");
  const recordType = await prompt("DNS record type (TXT/MX/A/CNAME/etc, or leave blank): ");
  const keywords = await prompt("Keywords (comma-separated): ");

  const template = await readFile("templates/issue.md", "utf-8");
  const content = replaceTemplateVars(template, {
    id,
    Title: title,
    subcategory,
    severity: severity || "medium",
    record_type: recordType || "",
    keyword1: keywords.split(",")[0]?.trim() || id,
    keyword2: keywords.split(",")[1]?.trim() || "",
    date: getToday(),
  });

  const outputPath = `content/periodic/issues/${subcategory}/${id}.md`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);

  console.log(chalk.green(`\n✅ Created: ${outputPath}\n`));
  rl.close();
}

async function scaffoldControl() {
  console.log(chalk.bold("\n📝 New Control Document\n"));

  const title = await prompt("Control title (e.g., 'Require MFA for Admin Accounts'): ");
  const id = toKebabCase(title);
  const framework = await prompt("Framework (e.g., 'm365-security-baseline', 'iso27001-2022'): ");
  const category = await prompt("Category (e.g., 'identity', 'data', 'devices'): ");
  const controlFamily = await prompt("Control family (e.g., 'authentication', 'encryption'): ");
  const severity = await prompt("Severity (critical/high/medium/low): ");
  const effort = await prompt("Implementation effort (low/medium/high): ");
  const keywords = await prompt("Keywords (comma-separated): ");

  const template = await readFile("templates/control.md", "utf-8");
  const content = replaceTemplateVars(template, {
    id,
    "Control Title": title,
    framework,
    category,
    control_family: controlFamily,
    severity: severity || "medium",
    effort: effort || "medium",
    keyword1: keywords.split(",")[0]?.trim() || id,
    keyword2: keywords.split(",")[1]?.trim() || "",
    date: getToday(),
  });

  const frameworkPath = framework.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const outputPath = `content/pulse/frameworks/${frameworkPath}/controls/${id}.md`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);

  console.log(chalk.green(`\n✅ Created: ${outputPath}\n`));
  rl.close();
}

async function scaffoldConcept() {
  console.log(chalk.bold("\n📝 New Concept Document\n"));

  const title = await prompt("Concept title (e.g., 'What is SPF?'): ");
  const id = toKebabCase(title.replace(/^what is /i, ""));
  const keywords = await prompt("Keywords (comma-separated): ");
  const products = await prompt("Products (periodic/pulse/quiz/nexus, comma-separated): ");

  const content = `---
id: ${id}
category: concept
keywords:
  - ${keywords.split(",").map((k) => k.trim()).join("\n  - ")}
related_issues: []
products:
  - ${products.split(",").map((p) => p.trim()).join("\n  - ")}
last_updated: ${getToday()}
---

# ${title}

## Summary

<!-- 2-3 sentences: What is this concept? -->

## The Simple Explanation

<!-- Analogy or metaphor to make this accessible -->

## How It Works

<!-- Technical explanation with diagrams if helpful -->

\`\`\`mermaid
flowchart LR
    A[Input] --> B[Process]
    B --> C[Output]
\`\`\`

## Key Points

- 
- 
- 

## Common Misconceptions

- 
- 

## Related Topics

- [Related Concept 1](/concepts/related-1)
- [Related Issue 1](/issues/related-1)
`;

  const outputPath = `content/periodic/concepts/${id}.md`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);

  console.log(chalk.green(`\n✅ Created: ${outputPath}\n`));
  rl.close();
}

async function scaffoldQuiz() {
  console.log(chalk.bold("\n📝 New Quiz Bank\n"));

  const title = await prompt("Quiz title (e.g., 'Email Security Fundamentals'): ");
  const id = toKebabCase(title);
  const description = await prompt("Description: ");
  const difficulty = await prompt("Difficulty (beginner/intermediate/advanced/mixed): ");
  const tags = await prompt("Tags (comma-separated): ");

  const content = `# ${title}

id: ${id}
title: ${title}
description: ${description}
difficulty: ${difficulty || "mixed"}
tags:
  - ${tags.split(",").map((t) => t.trim()).join("\n  - ")}

source_content: []

questions:
  - id: ${id}-001
    type: multiple-choice
    question: |
      Your first question here?
    options:
      - id: a
        text: Option A
      - id: b
        text: Option B
      - id: c
        text: Option C
      - id: d
        text: Option D
    correct: a
    explanation: |
      Explanation of why A is correct.
    reference: periodic/concepts/related-concept.md
    difficulty: beginner
    points: 1
`;

  const outputPath = `content/quiz/banks/${id}.yaml`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);

  console.log(chalk.green(`\n✅ Created: ${outputPath}\n`));
  rl.close();
}

// CLI setup
program
  .name("scaffold")
  .description("Create new content from templates");

program
  .argument("<type>", "Content type: issue, control, concept, quiz")
  .action(async (type: string) => {
    switch (type.toLowerCase()) {
      case "issue":
        await scaffoldIssue();
        break;
      case "control":
        await scaffoldControl();
        break;
      case "concept":
        await scaffoldConcept();
        break;
      case "quiz":
        await scaffoldQuiz();
        break;
      default:
        console.error(chalk.red(`Unknown content type: ${type}`));
        console.log("Valid types: issue, control, concept, quiz");
        process.exit(1);
    }
  });

program.parse();
