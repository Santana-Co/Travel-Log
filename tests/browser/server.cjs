const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const port = 4173;
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript" };

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  try {
    if (pathname === "/config.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end('window.TravelLogConfig = { environment: "test", buildLabel: "Browser test", supabaseUrl: "https://synthetic.invalid", supabasePublishableKey: "synthetic-publishable-key", distanceApiUrl: "https://routing.invalid" };');
      return;
    }

    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const filename = path.resolve(root, relative);
    if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) throw new Error("Invalid path");
    let body = await fs.readFile(filename);
    if (relative === "index.html") {
      body = Buffer.from(body.toString().replace(
        /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3"[^>]*><\/script>/,
        '<script src="tests/browser/supabase-fixture.js"></script>',
      ));
    }
    response.writeHead(200, { "content-type": types[path.extname(filename)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
