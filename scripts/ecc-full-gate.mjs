import {
  execFileSync,
} from "node:child_process";

const commands = [
  ["npm", ["test"]],
  ["npm", ["run", "lint"]],
  ["npx", ["tsc", "--noEmit"]],
  ["git", ["diff", "--check"]],
  ["npm", ["run", "build"]],
];

for (
  const [command, args]
  of commands
) {
  console.log(
    `\n=== ${command} ${args.join(" ")} ===\n`
  );

  try {
    execFileSync(
      command,
      args,
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    );
  } catch {
    console.error(
      `FAILED: ${command} ${args.join(" ")}`
    );

    process.exit(1);
  }
}

console.log(
  "\nECC FULL RELEASE GATE: PASS"
);
