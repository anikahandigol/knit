# KnitNeedle VS Code Extension

The KnitNeedle extension provides integration with the **Knit** framework, allowing you to quickly run Gradle tasks and visualize dependency changes in Knit-enabled projects.

---

## Features

- **Knit: Hello World**  
  A simple test command to verify the extension is working.  

- **Knit: Watch and Build ShadowJar**  
  Runs `gradlew shadowJar --continuous` in a VS Code terminal, continuously rebuilding your project as changes are made.  

- **Dependency Graph Visualization**  
  View Knit component graphs directly in VS Code using d3js. Opens automatically upon running **Knit: Watch and Build ShadowJar**.

  Keybinds:
  Ctrl + Alt + D: Open Knit Dependency Graph
  Ctrl + Alt + F: Close Knit Dependency Graph

- **Knit: Refresh Graph**
  Manually refresh the dependency graph displayed in the KnitNeedle panel.

- **Knit: Load Graph from File**
  Load a previously computed dependency graph (e.g. from a .json file) into the KnitNeedle panel.
  
---

## Requirements

- **Java 17+** (ensure `java` is on your PATH).  
- **Gradle Wrapper (`gradlew` / `gradlew.bat`)** included in the project root.  
- A **Knit-enabled project** (this extension assumes a structure similar to the `demo-jvm` project).  

---

## Installation (Development Mode)

1. Clone this repository.  
2. Run `npm install` and `npm run build` inside the extension folder.  
3. Open the folder in **VS Code**.  
4. Press **F5** with `extension.ts` open to launch a new **Extension Development Host** window.  
5. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:  
   - `Knit: Hello World`  
   - `Knit: Watch and Build ShadowJar`  

---

## Usage

- Open a Knit project in VS Code.  
- Use **Knit: Watch and Build ShadowJar** to continuously rebuild your jar while editing.  
- Monitor the **Knit Watch** output terminal for build progress.  

---

## Configuration

Currently, the extension assumes:
- `gradlew` is located one directory up from the `demo-jvm` folder.  
- Builds are run inside the `demo-jvm` workspace.  

In the future, these paths may become configurable via extension settings.

---

## Development Notes

- Run `npm run compile` to build TypeScript changes.  
- Use **F5** to test the extension in a development host.  