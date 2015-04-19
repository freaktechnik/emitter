/*
 * Created by Martin Giger in 2015 for Ludum Dare 32
 * Licensed under the MPL-2.0
 */

/*
    Stuff, that didn't make it:
        - Music
        - Some sprites for like the player/emitter, enemies and walls
        - Nice font for titles 'n' stuff

    Additional non-goals:
        - Multi-resolution support (mainly needs work for the level definitions and Game.UNIT)

    Additional complexity ideas:
        - Enemies moving on a path ("defenders")
        - Pick up blasts for alternative solutions
        - Timed walls
        - Enemies which are "inverted" by the beam and switch between friendly (fighting for the player) and hostile

    So in case you're looking at this source and think: damn, those are some
    good ideas: go ahead, this is licensed under the MPL-2.0 after all!
 */
var summerSfx = new Audio("sfx/summer.MP3");
summerSfx.autoplay = false;
summerSfx.preload = true;
summerSfx.volume = 0.2;

var bummerSfx = new Audio("sfx/bummer.MP3");
bummerSfx.autoplay = false;
bummerSfx.preload = true;
bummerSfx.volume = 0.8;

var wummerSfx = new Audio("sfx/wummer.MP3");
wummerSfx.autoplay = false;
wummerSfx.loop = true;
wummerSfx.preload = true;

var summer, bummer, startWummer, stopWummer;

summerSfx.addEventListener("canplaythrough", function() {
    summer = function() {
        summerSfx.currentTime = 0;
        summerSfx.play();
    };
});

bummerSfx.addEventListener("canplaythrough", function() {
    bummer = function() {
        bummerSfx.currentTime = 0;
        bummerSfx.play();
    };
});

wummerSfx.addEventListener("canplaythrough", function() {
    wummerSfx.loop = true;
    startWummer = function() {
        wummerSfx.currentTime = 0;
        wummerSfx.play();
    };
    stopWummer = function() {
        wummerSfx.pause();
    };
});

function randomSign() {
    return Math.round(Math.random()) ? -1 : 1;
}

function sign(i) {
    if(i > 0)
        return 1;
    else if(i == 0)
        return i;
    else
        return -1;
}

function lineBetweenEntities(entityA, entityB) {
    var halfUnit = Game.UNIT/2;
    var Ax = entityA.x,
        Ay = entityA.y,
        Bx = entityB.x,
        By = entityB.y;

    var deltaX = Bx - Ax,
        deltaY = By - Ay;

    var line = [];

    if(deltaY == 0) {
        // horizontal line
        var direction = sign(deltaX);
        for(var x = Ax; x != Bx; x += direction) {
            line.push([x, Ay]);
        }
    }
    else if(deltaX == 0) {
        // vertical line
        var direction = sign(deltaY);
        for(var y = Ay; y != By; y += direction) {
            line.push([Ax, y]);
        }
    }
    else {
        // Calculate Line between the two entites
        var y = Ay,
            error = 0,
            deltaError = Math.abs(deltaY / deltaX),
            direction = sign(deltaX);

        for(var x = Ax; x != Bx; x += direction) {
            line.push([x, y]);
            error += deltaError;
            while(error > 0.5) {
                y += sign(deltaY);
                line.push([x, y]);
                error -= 1.0;
            }
        }
    }
    return line;
}

function copyEnemies(enemies) {
    return enemies.map(function(enemy) {
        return new Enemy(enemy.x, enemy.y);
    });
}

function Wall(startX, startY, endX, endY, proof) {
    if(endX < startX) {
        var c = startX;
        startX = endX;
        endX = c;
    }
    if(endY < startY) {
        var d = startY;
        startY = endY;
        endY = d;
    }
    this.x = startX;
    this.y = startY;
    this.width = endX - startX;
    this.height = endY - startY;

    this.bulletProof = proof || false;
    if(this.bulletProof) {
        this.color = "lightgray";
    }
}
Wall.prototype.x = 0;
Wall.prototype.y = 0;
Wall.prototype.height = 1;
Wall.prototype.width = 1;
Wall.prototype.bulletProof = false;
Wall.prototype.color = "white";
Wall.prototype.alive = true;
Wall.prototype.collidesWith = function(x, y, height, width) {
    return !(x >= this.x + this.width ||
             x + width <= this.x ||
             y + height <= this.y ||
             y >= this.y + this.height);
};

function Enemy(x, y) {
    this.x = x;
    this.y = y;
}
Enemy.prototype.x = 0;
Enemy.prototype.y = 0;
Enemy.prototype.height = 1;
Enemy.prototype.width = 1;
Enemy.prototype.alive = true;
Enemy.prototype.isLethal = true;
Enemy.prototype.color = "#B059D9";
Enemy.prototype.deadColor = "#4FA626";
Enemy.prototype.move = function() {
    if(this.alive) {
        var line = lineBetweenEntities(this, Player);
        var deltaX = line[1][0] - this.x;
        var deltaY = line[1][1] - this.y;

        if(Game.canMoveTo(this.x + deltaX, this.y + deltaY, this)) {
            this.x += deltaX;
            this.y += deltaY;
        }
        else if(Game.canMoveTo(this.x + deltaX, this.y, this)) {
            this.x += deltaX;
        }
        else if(Game.canMoveTo(this.x, this.y + deltaY, this)) {
            this.y += deltaY;
        }
    }
};
Enemy.prototype.kill = function() {
    this.alive = false;
};
Enemy.prototype.collidesWith = function(x, y, height, width) {
    return !(x >= this.x + this.width ||
             x + width <= this.x ||
             y + height <= this.y ||
             y >= this.y + this.height);
};


function Stage(options) {
    this.number = options.number;
    this.title = options.title;
    this.enemies = options.enemies;
    this.walls = options.walls;
    this.shots = options.shots || 1;
}
Stage.prototype.enemies = [];
Stage.prototype.number = 0;
Stage.prototype.shots = 1;
Stage.prototype.title = "";
Stage.prototype.walls = [];


var Player = {
    x: 0,
    y: 0,
    height: 1,
    width: 1,
    alive: true,
    shots: 0,
    color: "orange",
    blastWaveRadius: 0,
    blastWaveStart: 0,
    init: function(x, y) {
        x = x || 0;
        y = y || 0;

        this.x = x;
        this.y = y;
    },
    move: function(deltaX, deltaY) {
        if(this.alive && !this.blastWaveRadius && !this.blastWaveStart &&
           Game.canMoveTo(this.x + deltaX, this.y + deltaY, this)) {
            this.x += deltaX;
            this.y += deltaY;

            this.checkAlive();
            Game.onPlayerMoved();
        }
    },
    useWeapon: function() {
        if(this.shots > 0 && Player.alive) {
            Game.enemies.forEach(function(enemy) {
                if(!Game.isBlockingWallBetweenEntities(Player, enemy))
                    enemy.kill();
            });
            --this.shots;

            this.blastWaveRadius = 1;
            startWummer();

            Game.onAfterUseWeapon();
        }
    },
    checkAlive: function() {
        this.alive = !Game.enemies.some(function(enemy) {
                         return enemy.isLethal && enemy.collidesWith(this.x-1, this.y-1, this.width+2, this.height+2);
                      }, this);
        if(!this.alive)
            bummer();
    },
    moveWave: function(timestamp) {
        if(this.blastWaveStart == 0) {
            this.blastWaveStart = timestamp;
        }

        var px = this.x * Game.UNIT, py = this.y * Game.UNIT;
        var hh = Math.max(Game.HEIGHT - py, py), hw = Math.max(Game.WIDTH - px, px);
        if(this.blastWaveRadius > Math.sqrt(hw * hw + hh * hh)) {
            this.blastWaveRadius = 0;
            this.blastWaveStart = 0;
            stopWummer();
            if(Game.gameOver)
                bummer();
        }
        else {
            var velocity = 0.65; // px/ms

            this.blastWaveRadius = (timestamp - this.blastWaveStart) * velocity;
        }
    },
    getFacingSide: function(x, y, width, height) {
        // Todo respect the smaller side, if it's facing the player (the player is not withing the wall's ends)
        var rx, ry, rw = 0, rh = 0, cw = false, ch = false;
        if(x < this.x) {
            rx = x + width;
            cw = true;
        }
        else {
            rx = x;
        }
        if(y < this.y) {
            ry = y + height;
            ch = true;
        }
        else {
            ry = y;
        }

        if(cw) {
            rw = -width;
        }
        else {
            rw = width;
        }

        if(ch) {
            rh = -height;
        }
        else {
            rh = height;
        }
        return { x: rx, y: ry, height: rh, width: rw };
    }
};

var Game = {
    UNIT: 10,
    HEIGHT: 600,
    WIDTH: 900,
    FONT: "mono,Consolas,monospace",
    ctx: null,
    enemies: [],
    stage: null,
    loading: true,
    win: false,
    gameOver: false,
    titleTimestamp: 0,
    buttons: [],
    init: function(ctx) {
        this.ctx = ctx.getContext("2d");

        Player.init();
        if(!window.localStorage.getItem("stage"))
            window.localStorage.setItem("stage", 0);

        this.loadStage(Stages[parseInt(window.localStorage.getItem("stage"), 10)]);

        this.keyboardInputHandler = this.keyboardInputHandler.bind(this);

        ctx.addEventListener("keydown", this.keyboardInputHandler);
        ctx.addEventListener("click", this.clickHandler);
        ctx.focus();

        this.render = this.render.bind(this);
        window.requestAnimationFrame(this.render);
    },
    loadStage: function(stage) {
        this.loading = true;

        this.stage = stage;

        this.enemies = copyEnemies(stage.enemies);

        Player.shots += stage.shots;
        Player.x = this.WIDTH / this.UNIT * 0.5;
        Player.y = this.HEIGHT / this.UNIT * 0.5;
        Player.blastWaveRadius = 0;
        Player.blastWaveStart = 0;

        this.titleTimestamp = 0;

        this.loading = false;
        if(summer)
            summer();

        window.localStorage.setItem("stage", stage.number -1);
    },
    keyboardInputHandler: function(event) {
        event.preventDefault();

        if(!this.loading && !this.win && !this.gameOver) {
            var code = event.keyCode || event.charCode;
            if(event.key == "ArrowLeft" || code == 37) {
                Player.move(-1, 0);
            }
            else if(event.key == "ArrowUp" || code == 38) {
                Player.move(0, -1);
            }
            else if(event.key == "ArrowRight" || code == 39) {
                Player.move(1, 0);
            }
            else if(event.key == "ArrowDown" || code == 40) {
                Player.move(0, 1);
            }
            else if(event.key == " " || code == 32) {
                Player.useWeapon()
            }
        }
    },
    clickHandler: function(event) {
        Game.buttons.forEach(function(button) {
            if(event.clientX > button.x &&
               event.clientX < button.x + button.width &&
               event.clientY > button.y &&
               event.clientY < button.y + button.height)
                button.handler();
        });
    },
    printTitleText: function(text, color, scolor) {
        color = color || "#7AE3FA";

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = color;
        this.ctx.font = "60px "+this.FONT;
        this.ctx.shadowColor = "#061B40";
        this.ctx.shadowOffsetX = -2;
        this.ctx.shadowOffsetY = 2;
        this.ctx.fillText(text, this.WIDTH/2, this.HEIGHT/2, this.WIDTH);
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    },
    render: function(timestamp) {
        this.buttons.length = 0;
        this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);

        if(this.loading) {
            this.ctx.fillStyle = "#10336E";
            this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
            this.printTitleText("Loading...");
        }
        else if(this.win) {
            this.ctx.fillStyle = "#EFCC91";
            this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

            this.ctx.setTransform(this.UNIT, 0, 0, this.UNIT, 0, 0);
            Player.color = "#005AFF";
            this.printEntity(Player);
            this.ctx.resetTransform();

            this.printTitleText("The End", "green", "transparent");
        }
        else {
            this.ctx.fillStyle = "#10336E";
            this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

            // Print wall shadows
            this.stage.walls.forEach(function(wall) {
                if(wall.bulletProof)
                    this.printShadow(wall, "#061B40 ");
            }, this);

            this.ctx.setTransform(this.UNIT, 0, 0, this.UNIT, 0, 0);

            this.ctx.shadowBlur = 7;
            this.ctx.shadowColor = "#061B40";
            //Print enemies
            this.enemies.forEach(function(enemy) {
                this.printEntity(enemy);
            }, this);

            this.printEntity(Player);

            this.ctx.shadowBlur = 0;

            //Print walls
            this.stage.walls.forEach(function(wall) {
                this.printEntity(wall);
            }, this);

            this.ctx.resetTransform();

            if(Player.blastWaveRadius > 0 || Player.blastWaveStart > 0) {
                Player.moveWave(timestamp);
                this.ctx.beginPath();
                this.ctx.globalCompositeOperation = "difference";
                this.ctx.fillStyle = "#ffffff";
                this.ctx.arc(Player.x * this.UNIT + this.UNIT/2, Player.y * this.UNIT + this.UNIT/2, Player.blastWaveRadius, 0, 2 * Math.PI, false);
                this.ctx.fill();
                this.ctx.closePath();
                this.ctx.globalCompositeOperation = "source-over";
            }

            if(!Player.alive) {
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
                this.printTitleText("An Evil Square Ended You");
                this.ctx.shadowColor = "#061B40";
                this.ctx.shadowOffsetX = -1;
                this.ctx.shadowOffsetY = 1;
                this.printButton(this.WIDTH/2, this.HEIGHT/2 + 55, "Retry", function() {
                    Player.shots = 0;
                    Game.gameOver = false;
                    Player.alive = true;
                    Game.loadStage(Game.stage);
                });
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }
            else if(this.gameOver && Player.blastWaveRadius == 0 && Player.blastWaveStart == 0) {
                this.ctx.globalCompositeOperation = "difference";
                this.ctx.fillStyle = "#ffffff";
                this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
                this.ctx.globalCompositeOperation = "source-over";
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
                this.printTitleText("Didn't End All Evil Squares");
                this.ctx.shadowColor = "#061B40";
                this.ctx.shadowOffsetX = -1;
                this.ctx.shadowOffsetY = 1;
                this.printButton(this.WIDTH/2, this.HEIGHT/2 + 55, "Retry", function() {
                    Player.shots = 0;
                    Game.gameOver = false;
                    Player.alive = true;
                    Game.loadStage(Game.stage);
                });
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }
            else if(this.titleTimestamp == 0 || timestamp - this.titleTimestamp < 1800) {
                if(this.titleTimestamp == 0)
                    this.titleTimestamp = timestamp;
                this.printTitleText(this.stage.title);

                this.ctx.textAlign = "middle";
                this.ctx.textBaseline = "bottom";
                this.ctx.fillStyle = "#7AE3FA";
                this.ctx.font = "30px "+this.FONT;
                this.ctx.shadowColor = "#061B40";
                this.ctx.shadowOffsetX = -2;
                this.ctx.shadowOffsetY = 2;
                this.ctx.fillText("Stage "+this.stage.number+":", this.WIDTH/2, this.HEIGHT/2 - 34);
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }

            // Print remaining shots
            this.ctx.shadowColor = "#061B40";
            this.ctx.shadowOffsetX = -2;
            this.ctx.shadowOffsetY = 2;
            this.ctx.textAlign = "right";
            this.ctx.textBaseline = "top";
            this.ctx.fillStyle = "#7AE3FA";
            this.ctx.font = "30px "+this.FONT;

            this.ctx.fillText("Charges: "+Player.shots, this.WIDTH - this.UNIT, this.UNIT);

            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        }

        if(!this.win)
            window.requestAnimationFrame(this.render);
    },
    printButton: function(x, y, text, handler, color) {
        this.ctx.fillStyle = color || "#7AE3FA";
        this.ctx.font = "30px "+this.FONT;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(text, x, y);
        var textMetric = this.ctx.measureText(text);

        var rad = 5, pad = 10, hw = textMetric.width / 2 + pad, hh = 15 + pad;
        this.ctx.beginPath();
        this.ctx.strokeStyle = color || "#7AE3FA";
        this.ctx.moveTo(x - hw, y - hh + rad);
        this.ctx.arc(x - hw + rad, y - hh + rad, rad, Math.PI, 3*Math.PI/2, false);
        this.ctx.arc(x + hw - rad, y - hh + rad, rad, 3*Math.PI/2, 0, false);
        this.ctx.arc(x + hw - rad, y + hh - rad, rad, 0, Math.PI/2, false);
        this.ctx.arc(x - hw + rad, y + hh - rad, rad, Math.PI/2, Math.PI, false);
        // this.ctx.lineTo(x - hw, y - hh + rad);
        this.ctx.closePath();
        this.ctx.stroke();
        this.buttons.push({x: x - hw, y: y - hh, height: 30 + 2 * pad, width: textMetric.width + 2 * pad, handler: handler});
    },
    printEntity: function(entity) {
        if(!entity.alive && !Player.blastWaveRadius && !Player.blastWaveStart)
            this.ctx.fillStyle = entity.deadColor || "red";
        else
            this.ctx.fillStyle = entity.color || "white";

        this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
    },
    printShadow: function(wall, color) {
        // To cite from the "10 top traditional warnings in coments" list:
        // Here be dragons!
        this.ctx.beginPath();

        var side = Player.getFacingSide(wall.x, wall.y, wall.width, wall.height);
        var orientation = sign(Math.abs(side.width) - Math.abs(side.height));
        var px = Player.x + 0.5, py = Player.y + 0.5;
        var playerSide;
        var getPlayerSide = function (side, orientation) {
            var ret;
             if(orientation == 1) {
                if(py < Math.min(side.y, side.y + side.height))
                    ret = -1;
                else if(py > Math.max(side.y, side.y + side.height))
                    ret = 1;
                else
                    ret = 0;
            }
            else {
                if(px < Math.min(side.x, side.x + side.width))
                    ret = -1;
                else if(px > Math.max(side.x, side.x + side.width))
                    ret = 1;
                else
                    ret = 0;
            }
            return ret;
        };

        playerSide = getPlayerSide(side, orientation);

        if(playerSide == 0) {
            orientation = -orientation;
            playerSide = getPlayerSide(side, orientation);
        }

        var playerPosition = 0;
        if(orientation == 1) {
            if(px < Math.min(side.x, side.x + side.width))
                playerPosition = -1;
            else if(px > Math.max(side.x, side.x + side.width))
                playerPosition = 1;
        }
        else {
            if(py < Math.min(side.y, side.y + side.height))
                playerPosition = -1;
            else if(py > Math.max(side.y, side.y + side.height))
                playerPosition = 1;
        }

        var distanceToWall, yBack;
        if(orientation == 1) {
            if(playerSide == 1) {
                distanceToWall = side.y;
                yBack = 0;
            }
            else {
                yBack = this.HEIGHT;
                distanceToWall = this.HEIGHT/this.UNIT - side.y;
            }
        }
        else {
            if(playerSide == 1) {
                distanceToWall = side.x;
                yBack = 0;
            }
            else if(playerSide == -1) {
                yBack = this.WIDTH;
                distanceToWall = this.WIDTH/this.UNIT - side.x;
            }
        }

        var x1, y1, x2, y2;
        if(orientation == 1) {
            if(playerPosition == -1) {
                if(playerSide == -1) {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.max(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = Math.min(side.y, side.y + side.height);
                }
                else {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = Math.max(side.y, side.y + side.height);
                }
            }
            else if(playerPosition == 0) {
                if(playerSide == -1) {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = y1;
                }
                else {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.max(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = y1;
                }
            }
            else {
                if(playerSide == -1) {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = Math.max(side.y, side.y + side.height);
                }
                else {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.max(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = Math.min(side.y, side.y + side.height);
                }
            }
        }
        else {
            if(playerPosition == -1) {
                if(playerSide == -1) {
                    x1 = Math.max(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.min(side.x, side.x + side.width);
                    y2 = Math.max(side.y, side.y + side.height);
                }
                else {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = Math.max(side.y, side.y + side.height);
                }
            }
            else if(playerPosition == 0) {
                if(playerSide == -1) {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = x1;
                    y2 = Math.max(side.y, side.y + side.height);
                }
                else {
                    x1 = Math.max(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = x1;
                    y2 = Math.max(side.y, side.y + side.height);
                }
            }
            else {
                if(playerSide == -1) {
                    x1 = Math.min(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.max(side.x, side.x + side.width);
                    y2 = Math.max(side.y, side.y + side.height);
                }
                else {
                    x1 = Math.max(side.x, side.x + side.width);
                    y1 = Math.min(side.y, side.y + side.height);
                    x2 = Math.min(side.x, side.x + side.width);
                    y2 = Math.max(side.y, side.y + side.height);
                }
            }
        }

        this.ctx.moveTo(x1 * this.UNIT, y1 * this.UNIT);
        this.ctx.lineTo(x2 * this.UNIT, y2 * this.UNIT);

        var xBack;

        if(orientation == 1) {
            // callculate the x difference of the shadow on the outer border
            xBack = distanceToWall * (x2 - px)/(y2 - py);
            // tangens sign correction
            if(py < y2)
                xBack = -xBack;
            this.ctx.lineTo((x2 - xBack) * this.UNIT, yBack);
        }
        else {
            xBack = distanceToWall * (y2 - py)/(x2 - px);
            if(px < x2)
                xBack = -xBack;
            this.ctx.lineTo(yBack, (y2 - xBack) * this.UNIT);
        }

        // Let's repeat that.
        if(orientation == 1) {
            xBack = distanceToWall * (x1 - px)/(y1 - py);
            if(py < y1)
                xBack = -xBack;
            this.ctx.lineTo((x1 - xBack) * this.UNIT, yBack);
        }
        else {
            xBack = distanceToWall * (y1 - py)/(x1 - px);
            if(px < x1)
                xBack = -xBack;
            this.ctx.lineTo(yBack, (y1 - xBack) * this.UNIT);
        }

        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
    },
    canMoveTo: function(x, y, entity) {
        var hasEntity = this.enemies.some(function(enemy) {
            return enemy.collidesWith(x, y, entity.width, entity.height);
        });
        var hasWall = this.stage.walls.some(function(wall) {
            return wall.collidesWith(x, y, entity.width, entity.height);
        });
        return !hasEntity &&
                !hasWall;
    },
    onPlayerMoved: function() {
        this.enemies.forEach(function(enemy) {
            enemy.move();
        });
    },
    onAfterUseWeapon: function() {
        var doNextLevel = (function() {
            if(Player.blastWaveStart == 0 && Player.blastWaveRadius == 0) {
                if(Stages.length > this.stage.number)
                    this.loadStage(Stages[this.stage.number]);
                else
                    this.win = true;
            }
            else {
                window.requestAnimationFrame(doNextLevel);
            }
        }).bind(this);
        if(this.enemies.every(function(enemy) {
            return !enemy.alive;
        })) {
            doNextLevel();
        }
        else if(Player.shots == 0) {
            this.gameOver = true;
        }
    },
    isBlockingWallBetweenEntities: function(entityA, entityB) {
        var line = lineBetweenEntities(entityA, entityB);

        return this.stage.walls.some(function(wall) {
            return line.some(function(point) {
                return wall.bulletProof && wall.collidesWith(point[0], point[1], 1, 1);
            }, this);
        }, this);
    }
};

var gw = Game.WIDTH / Game.UNIT, gh = Game.HEIGHT / Game.UNIT,
     xc = gw / 2, yc = gh / 2;
var Stages = [
    new Stage({
        number: 1,
        title: "Press Space",
        enemies: [
            new Enemy(14, 14)
        ],
        walls: [
            new Wall(0, 0, gw, 1),
            new Wall(0, 0, 1, gh),
            new Wall(gw, 0, gw - 1, gh),
            new Wall(gw, gh, 0, gh - 1),
            new Wall(9, 8, 8, 21),
            new Wall(20, 8, 21, 21),
            new Wall(8, 9, 21, 8),
            new Wall(8, 20, 21, 21)
        ]
    }),
    new Stage({
        number: 2,
        title: "Move With The Arrow Keys",
        enemies: [
            new Enemy(78, 58),
            new Enemy(32, 25)
        ],
        walls: [
            new Wall(34, 19, 55, 20, false),
            new Wall(35, 19, 34, 41, false),
            new Wall(34, 40, 55, 41, false),
            new Wall(55, 41, 56, 19, true)
        ]
    }),
    new Stage({
        number: 3,
        title: "Don't Let It Hide",
        enemies: [
            new Enemy(10, yc)
        ],
        walls: [
            new Wall(0, 0, gw, 1),
            new Wall(0, 0, 1, gh),
            new Wall(gw, 0, gw - 1, gh),
            new Wall(gw, gh, 0, gh - 1),
            new Wall(20, gh - 10, 21, 0, true),
            new Wall(20, gh - 10, 21, gh),

        ]
    }),
    new Stage({
        number: 4,
        title: "Don't Let Them Hide",
        enemies: [
            new Enemy(35, 30),
            new Enemy(55, 30)
        ],
        walls: [
            new Wall(0, 0, 90, 1),
            new Wall(0, 0, 1, 60),
            new Wall(90, 0, 89, 90),
            new Wall(90, 60, 0, 59),
            new Wall(40, 20, 41, 40, true),
            new Wall(50, 20, 49, 40, true)
        ]
    }),
    new Stage({
        number: 5,
        title: ":C",
        enemies: [
            new Enemy(xc - 10, yc - 15),
            new Enemy(xc + 10, yc - 15),
            new Enemy(xc, yc + 10)
        ],
        walls: [
            new Wall(0, 0, gw, 1),
            new Wall(0, 0, 1, gh),
            new Wall(gw, 0, gw - 1, gh),
            new Wall(gw, gh, 0, gh - 1),
            new Wall(35, 35, 55, 34, true)
        ]
    }),
    new Stage({
        number: 6,
        title: "Just Don't Move Into Them",
        enemies: [
            new Enemy(xc - 13, yc),
            new Enemy(xc + 13, yc),
            new Enemy(xc, yc - 13),
            new Enemy(xc, yc + 13)
        ],
        walls: [
            new Wall(0, 0, gw, 1),
            new Wall(0, 0, 1, gh),
            new Wall(gw, 0, gw - 1, gh),
            new Wall(gw, gh, 0, gh - 1),
            new Wall(xc - 10, yc - 2, xc - 9, yc + 2, true),
            new Wall(xc + 10, yc - 2, xc + 9, yc + 2, true),
            new Wall(xc - 2, yc - 10, xc + 2, yc - 9, true),
            new Wall(xc - 2, yc + 10, xc + 2, yc + 9, true)
        ]
    }),
    new Stage({
        number: 7,
        title: "Hook",
        enemies: [
            new Enemy(24, 5),
            new Enemy(12, 24)
        ],
        walls: [
            new Wall(0, 0, gw, 1),
            new Wall(0, 0, 1, gh),
            new Wall(gw, 0, gw - 1, gh),
            new Wall(gw, gh, 0, gh - 1),
            new Wall(xc, 10, 20, 11, true),
            new Wall(20, 10, 21, gh - 21, true),
            new Wall(20, gh - 20, 21, gh - 10),
            new Wall(21, gh - 10, 10, gh - 11),
            new Wall(21, gh - 21, 15, gh - 20)
        ]
    }),
    // Always the last one
    new Stage({
        number: 8,
        title: "Impossible",
        enemies: [
            new Enemy( -5, -5)
        ],
        walls: [
            new Wall(0, 0, gw, 1),
            new Wall(0, 0, 1, gh),
            new Wall(gw, 0, gw - 1, gh),
            new Wall(gw, gh, 0, gh - 1),
            new Wall(-3, 0, -2, -10, true)
        ]
    })
];

Game.init(document.getElementById("ctx"));
