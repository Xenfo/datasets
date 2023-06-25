import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts";
import { keypress } from "https://deno.land/x/cliffy@v0.25.7/keypress/mod.ts";
import {
  Input,
  List,
  prompt,
} from "https://deno.land/x/cliffy@v0.25.7/prompt/mod.ts";
import { red } from "https://deno.land/std@0.192.0/fmt/colors.ts";
import { stringify } from "https://deno.land/std@0.192.0/yaml/mod.ts";

const tag = new Command()
  .description("Tag a dataset")
  .arguments("<dataset:string>")
  .action(async (_, dataset) => {
    console.log("");

    const info = await Deno.stat(dataset);
    if (!info.isDirectory) {
      console.log(`${red("Error:")} the dataset must be a directory`);
      Deno.exit(1);
    }

    const dirEntries = Deno.readDir(dataset);
    Deno.chdir(dataset);

    let index = 0;
    for await (const dirEntry of dirEntries) {
      if (!dirEntry.isFile) {
        continue;
      }

      await new Deno.Command("wsl-open", {
        args: [dirEntry.name],
      }).output();

      console.log(
        `Tagging ${dirEntry.name}..., would you like to continue? (esc to skip, any other key to continue)`,
      );

      const event = await keypress();
      if (event.key !== "escape") {
        const newName = dirEntry.name.toLowerCase().split(".").map((part, i) =>
          i === 0 ? index.toString().padStart(5, "0") : part
        ).join(".");

        if (dirEntry.name.toLowerCase().endsWith(".heic")) {
          await new Deno.Command(
            "heif-convert",
            {
              args: [
                "-q",
                "100",
                dirEntry.name,
                newName.replace(".heic", ".png"),
              ],
            },
          ).output();

          await Deno.remove(dirEntry.name);
        } else {
          await Deno.rename(dirEntry.name, newName);
        }

        const result = await prompt([{
          name: "prompt",
          message: "What's the prompt?",
          type: Input,
        }, {
          name: "tags",
          message: "What are the tags? (eg. tag1, tag2:1.5)",
          type: List,
        }]);

        const yaml = stringify({
          main_prompt: result.prompt,
          tags: result.tags?.map((tag) =>
            tag.match(":")
              ? tag.split(":").reduce((acc, curr, i) => ({
                ...acc,
                ...{
                  [i === 0 ? "tag" : "weight"]: i === 0
                    ? curr
                    : parseFloat(curr),
                },
              }), {})
              : tag
          ),
        });

        await Deno.writeFile(
          newName.replace(/\..+/g, ".yaml"),
          new TextEncoder().encode(yaml),
        );
      } else {
        await Deno.remove(dirEntry.name);
      }

      await new Deno.Command(
        "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
        {
          args: [
            "taskkill",
            "/IM",
            "PhotosApp.exe",
            "/F",
          ],
        },
      ).output();

      index++;
    }
  });

await new Command()
  .name("datasets")
  .description("A manager for your datasets")
  .version("0.1.0")
  .command("tag", tag)
  .parse();
