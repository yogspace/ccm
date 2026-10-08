// payload run … create|delete – a throwaway admin for the builder test.
import { writeFileSync } from "node:fs";
import { getPayload } from "payload";
import config from "@payload-config";

const EMAIL = "builder-test@example.invalid";
const main = async () => {
  const payload = await getPayload({ config });
  const mode = process.argv.at(-1);
  if (mode === "create") {
    const password = crypto.randomUUID();
    await payload.delete({ collection: "users", where: { email: { equals: EMAIL } } });
    await payload.create({ collection: "users", data: { email: EMAIL, password } });
    writeFileSync("/private/tmp/claude-501/-Users-max-Documents-Repos-ccm/2551e1ab-4120-4fe9-a2ad-481a6ff7ee38/scratchpad/payload/cred.json", JSON.stringify({ email: EMAIL, password }));
    console.log("created");
  } else {
    const { docs } = await payload.delete({ collection: "users", where: { email: { equals: EMAIL } } });
    console.log("deleted users:", docs.length);
  }
  process.exit(0);
};
main();
