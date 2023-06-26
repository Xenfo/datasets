import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts";
import {
  Confirm,
  Input,
  List,
  prompt,
} from "https://deno.land/x/cliffy@v0.25.7/prompt/mod.ts";
import { blue, red } from "https://deno.land/std@0.192.0/fmt/colors.ts";
import { stringify } from "https://deno.land/std@0.192.0/yaml/mod.ts";

const tag = new Command()
  .description("Tag a dataset")
  .arguments("<dataset:string> [start:number]")
  .action(async (_, dataset, start) => {
    console.log("");

    const info = await Deno.stat(dataset).catch(() => null);
    if (!info?.isDirectory) {
      console.log(`${red("Error:")} The dataset must be a directory`);
      Deno.exit(1);
    }

    const dirEntries = Deno.readDir(dataset);
    Deno.chdir(dataset);

    let index = start ?? 0;
    for await (const dirEntry of dirEntries) {
      if (!dirEntry.isFile || dirEntry.name.toLowerCase().endsWith(".yaml")) {
        continue;
      }

      const newName = dirEntry.name.toLowerCase().split(".").map((part, i) =>
        i === 0 ? index.toString().padStart(5, "0") : part
      ).join(".");
      index++;

      if (dirEntry.name === newName) {
        continue;
      }

      console.log(`${blue("Info:")} Tagging ${dirEntry.name}`);

      await new Deno.Command("wsl-open", {
        args: [dirEntry.name],
      }).output();

      const result = await prompt([{
        name: "continue",
        message: "Do you want to keep this image?",
        type: Confirm,
        default: true,
        after: async (results, next) => {
          if (results.continue) {
            await next();
          }
        },
      }, {
        name: "prompt",
        message: "What's the prompt?",
        type: Input,
      }, {
        name: "tags",
        message: "What are the tags? (eg. tag1, tag2:1.5)",
        type: List,
      }]);

      if (!result.continue) {
        await Deno.remove(dirEntry.name);
        continue;
      }

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

      const yaml = stringify({
        main_prompt: result.prompt,
        tags: result.tags?.map((tag) =>
          tag.match(":")
            ? tag.split(":").reduce((acc, curr, i) => ({
              ...acc,
              ...{
                [i === 0 ? "tag" : "weight"]: i === 0 ? curr : parseFloat(curr),
              },
            }), {})
            : tag
        ),
      });

      await Deno.writeFile(
        newName.replace(/\..+/g, ".yaml"),
        new TextEncoder().encode(yaml),
      );

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
    }
  });

await new Command()
  .name("datasets")
  .description("A manager for your datasets")
  .version("0.1.0")
  .command("tag", tag)
  .parse();
