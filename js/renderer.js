window.TE = window.TE || {};

window.TE.GameRenderer = class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  draw(game) {
    const { ctx, canvas } = this;

    // Clear canvas
    ctx.fillStyle = "#0a0a15";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (["playing", "paused", "gameover", "win"].includes(game.status)) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.clip();

      this.drawEscapeZone(game);
      this.drawDangerIndicators(game);
      this.drawGrid(game);
      this.drawCurrentPiece(game);
      this.drawPlayer(game);
      this.drawParticles(game);

      ctx.restore();
    }
  }

  drawGrid(game) {
    const { ctx, canvas } = this;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= game.constants.COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * game.constants.CELL_SIZE, 0);
      ctx.lineTo(x * game.constants.CELL_SIZE, canvas.height);
      ctx.stroke();
    }
    // Horizontal lines
    for (let y = 0; y <= game.constants.ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * game.constants.CELL_SIZE);
      ctx.lineTo(canvas.width, y * game.constants.CELL_SIZE);
      ctx.stroke();
    }

    // Blocks
    for (let y = 0; y < game.constants.ROWS; y++) {
      for (let x = 0; x < game.constants.COLS; x++) {
        if (game.grid[y][x]) {
          this.drawBlock(
            x * game.constants.CELL_SIZE,
            y * game.constants.CELL_SIZE,
            game.grid[y][x],
            game.constants.CELL_SIZE
          );
        }
      }
    }
  }

  drawBlock(x, y, color, size) {
    const { ctx } = this;
    const s = size;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x + 2, y + 2, s - 4, 6);
    ctx.fillRect(x + 2, y + 2, 6, s - 4);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x + s - 8, y + 8, 6, s - 10);
    ctx.fillRect(x + 8, y + s - 8, s - 10, 6);
  }

  drawCurrentPiece(game) {
    if (!game.currentPiece) return;
    const p = game.currentPiece;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (p.shape[y][x]) {
          this.drawBlock(
            (p.x + x) * game.constants.CELL_SIZE,
            (p.y + y) * game.constants.CELL_SIZE,
            p.color,
            game.constants.CELL_SIZE
          );
        }
      }
    }
  }

  drawPlayer(game) {
    const { ctx } = this;
    const p = game.player;
    if (!p) return;

    if (p.dead) {
      ctx.font = `${game.constants.CELL_SIZE}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😵", p.x + game.constants.PLAYER_WIDTH / 2, p.y + game.constants.PLAYER_HEIGHT / 2);
      return;
    }

    const w = game.constants.PLAYER_WIDTH;
    const h = game.constants.PLAYER_HEIGHT;

    // Body
    ctx.fillStyle = "#4ecca3";
    ctx.fillRect(p.x + w * 0.15, p.y + h * 0.28, w * 0.7, h * 0.45);

    // Head
    ctx.fillStyle = "#ffd93d";
    ctx.beginPath();
    ctx.arc(p.x + w / 2, p.y + h * 0.18, w * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#1a1a2e";
    const eyeOff = p.facingRight ? 3 : -3;
    ctx.beginPath();
    ctx.arc(p.x + w / 2 + eyeOff - 5, p.y + h * 0.16, 3, 0, Math.PI * 2);
    ctx.arc(p.x + w / 2 + eyeOff + 5, p.y + h * 0.16, 3, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#e94560";
    const legOff = Math.sin(Date.now() / 100) * 3 * (Math.abs(p.vx) > 0.1 ? 1 : 0);
    ctx.fillRect(p.x + w * 0.2, p.y + h * 0.7 + legOff, w * 0.25, h * 0.3);
    ctx.fillRect(p.x + w * 0.55, p.y + h * 0.7 - legOff, w * 0.25, h * 0.3);

    // Arms
    ctx.fillStyle = "#ffd93d";
    const armWave = p.onGround ? 0 : Math.sin(Date.now() / 80) * 15;
    ctx.save();
    ctx.translate(p.x + w * 0.1, p.y + h * 0.32);
    ctx.rotate(((-20 + armWave) * Math.PI) / 180);
    ctx.fillRect(-3, 0, 6, h * 0.28);
    ctx.restore();

    ctx.save();
    ctx.translate(p.x + w * 0.9, p.y + h * 0.32);
    ctx.rotate(((20 - armWave) * Math.PI) / 180);
    ctx.fillRect(-3, 0, 6, h * 0.28);
    ctx.restore();

    ctx.globalAlpha = 1;
  }

  drawParticles(game) {
    const { ctx } = this;
    game.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    });
    ctx.globalAlpha = 1;
  }

  drawEscapeZone(game) {
    const { ctx, canvas } = this;
    // Semi-transparent green background
    ctx.fillStyle = "rgba(78, 204, 163, 0.15)";
    ctx.fillRect(0, 0, canvas.width, game.constants.CELL_SIZE * 2);

    // Green dashed line at bottom of zone
    ctx.strokeStyle = "#4ecca3";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, game.constants.CELL_SIZE * 2);
    ctx.lineTo(canvas.width, game.constants.CELL_SIZE * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // "ESCAPE ZONE" text with better positioning
    ctx.fillStyle = "#4ecca3";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▲ ESCAPE ZONE ▲", canvas.width / 2, game.constants.CELL_SIZE - 2);
    ctx.textBaseline = "alphabetic"; // Reset to default
  }

  drawDangerIndicators(game) {
    const { ctx } = this;
    if (game.timers.playerLineClear > 0) {
      const cells = game.getPlayerCompletingCells();
      const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5; // 0 to 1

      ctx.save();
      ctx.shadowBlur = 10 + pulse * 10;
      ctx.shadowColor = "red";
      ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + pulse * 0.3})`;

      cells.forEach((c) => {
        ctx.fillRect(
          c.x * game.constants.CELL_SIZE,
          c.y * game.constants.CELL_SIZE,
          game.constants.CELL_SIZE,
          game.constants.CELL_SIZE
        );
      });
      ctx.restore();
    }
  }
};
