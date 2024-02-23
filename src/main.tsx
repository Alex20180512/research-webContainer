import "./style.css";
import { WebContainer } from "@webcontainer/api";
import { files } from "./files";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

document.querySelector("#root")!.innerHTML = `
  <div class="container">
    <div class="editor">
      <textarea>I am a textarea</textarea>
    </div>
    <div class="preview">
      <iframe src="loading.html"></iframe>
    </div>
  </div>
  <div class="terminal"></div>
`;

const iframeEl = document.querySelector("iframe")!;
const textareaEl = document.querySelector("textarea")!;
const terminalEl = document.querySelector(".terminal")! as HTMLElement;

let webcontainerInstance: WebContainer;

window.addEventListener("load", async () => {
  textareaEl.value = files["index.js"].file.contents;
  textareaEl.addEventListener("input", () => {
    writeIndexJS(textareaEl.value);
  });

  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.open(terminalEl);

  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(files);

  const exitCode = await installDependencies(terminal);
  if (exitCode !== 0) {
    throw new Error("Installation failed");
  }

  startDevServer(terminal);
});

async function installDependencies(terminal: Terminal) {
  const installProcess = await webcontainerInstance.spawn("npm", ["install"]);
  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  return installProcess.exit;
}

async function startDevServer(terminal: Terminal) {
  // Run `npm run start` to start the Express app
  const serverProcess = await webcontainerInstance.spawn("npm", [
    "run",
    "start",
  ]);
  serverProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  // Wait for `server-ready` event
  webcontainerInstance.on("server-ready", (_, url) => {
    iframeEl.src = url;
  });
}

async function writeIndexJS(content: string) {
  await webcontainerInstance.fs.writeFile("/index.js", content);
}
