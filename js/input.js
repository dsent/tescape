export class InputHandler {
  constructor() {
    this.keys = {};
    this.onPause = () => {};
    this.onSabotage = () => {};
    this.onDumpState = () => {};

    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));
    window.addEventListener("blur", () => this.handleBlur());
  }

  handleKeyDown(e) {
    this.keys[e.code] = true;
    // Prevent scrolling for game keys
    if (["ArrowUp", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();

    // Toggle Pause
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      this.onPause();
    }

    // Trigger Sabotage
    if (e.code === "KeyS") {
      e.preventDefault();
      this.onSabotage();
    }

    // Dump State (Debug) - F9 to avoid conflict with D=move right
    if (e.code === "F9") {
      e.preventDefault();
      this.onDumpState();
    }
  }

  handleKeyUp(e) {
    this.keys[e.code] = false;
  }

  handleBlur() {
    this.keys = {};
  }
}
