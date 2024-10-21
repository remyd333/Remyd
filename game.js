document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 652;

    const groundHeight = 100;
    const groundColor = '#8B4513';

    // Image Assets
    const backgrounds = ['images/back.jpg', 'images/forest-back.jpg', 'images/space-back.jpg'];
    const backgroundImg = new Image();
    backgroundImg.src = backgrounds[0]; // Set initial background image

    const playerImg = new Image();
    playerImg.src = 'images/head.png'; // Ensure correct path
    let originalPlayerImgSrc = playerImg.src; // Store original player image source

    const bulletImg = new Image();
    bulletImg.src = 'images/bullet.png'; // Ensure correct path
    const pokeImg = new Image();
    pokeImg.src = 'images/poke.png'; // Ensure correct path
    const teamImg = new Image();
    teamImg.src = 'images/team.png'; // Ensure correct path
    const enemyImages = ['images/enemy.png', 'images/enemy2.png', 'images/enemy3.png'].map(src => {
        const img = new Image();
        img.src = src; // Ensure correct paths
        return img;
    });

    // Game variables
    let score = 0;
    let lives = 10;
    let gameover = false;
    let paused = false; // Track game pause state
    let showMessage = false;
    let catchMessageTimer = 0;
    let playerTouched = false; // Track player touched state
    let lastEnemySpawnTime = 0;
    let enemySpawnInterval = 3000; // Adjust for difficulty scaling
    let lastPokeSpawnTime = 0;
    let pokeSpawnInterval = 8000; // Adjust for item spawn rate
    let enemies = [];
    let pokes = [];
    let jumping = false;
    let jumpVelocity = 0;
    let teamAppeared = false;
    let teamHealth = 10; // Define team health
    let startTime = Date.now(); // Record the start time when the game starts
    let level = 1; // Track game level

    // Sound
    const gameSound = new Audio('images/pokesounds.mp3'); // Ensure correct path
    gameSound.playRandomPart = function() {
        const randomStartTime = Math.random() * this.duration;
        if (isFinite(randomStartTime)) { // Check if the value is finite
            this.currentTime = randomStartTime;
            this.play();
        } else {
            console.error('Error: Unable to play random part of the sound.');
        }
    };

    // Play sound after user interaction due to autoplay restrictions
    document.addEventListener('click', function() {
        gameSound.playRandomPart();
    }, { once: true });

    // UI Elements
    const scoreDisplay = document.getElementById('score');
    const livesDisplay = document.getElementById('lives');
    const difficultyDisplay = document.getElementById('difficulty');
    const timerDisplay = document.getElementById('timer');
    const easyButton = document.getElementById('easyButton');
    const mediumButton = document.getElementById('mediumButton');
    const hardButton = document.getElementById('hardButton');
    scoreDisplay.innerText = `Score: ${score}`;
    livesDisplay.innerText = `Lives: ${lives}`;

    const player = {
        x: canvas.width / 2,
        y: canvas.height - groundHeight - 81.5,
        width: 80,
        height: 81.5,
        speed: 5,
        dx: 0,
        dy: 0,
        bullets: [],
        facingLeft: false, // Track player's facing direction
        shoot() {
            this.bullets.push({
                x: this.x + this.width / 2 - 10,
                y: this.y,
                width: 20,
                height: 20,
                img: bulletImg,
                speed: -10 // Bullet speed
            });
        },
        update() {
            this.x += this.dx;

            // Update bullets
            this.bullets.forEach(bullet => {
                bullet.y += bullet.speed; // Move bullets
            });
            // Remove off-screen bullets
            this.bullets = this.bullets.filter(bullet => bullet.y + bullet.height > 0);

            // Jumping mechanics
            if (jumping && this.onGround) {
                jumpVelocity = -this.jumpPower;
                this.onGround = false;
            }
            this.y += jumpVelocity;
            if (this.y >= canvas.height - groundHeight - this.height) {
                this.y = canvas.height - groundHeight - this.height;
                jumpVelocity = 0;
                this.onGround = true;
            } else {
                jumpVelocity += this.gravity;
            }

            if (this.x < 0) this.x = 0;
            if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        },
        draw() {
            if (this.dx < 0) {
                this.facingLeft = true;
            } else if (this.dx > 0) {
                this.facingLeft = false;
            }
            if (this.facingLeft) {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(playerImg, -this.x - this.width, this.y, this.width, this.height);
                ctx.restore();
            } else {
                ctx.drawImage(playerImg, this.x, this.y, this.width, this.height);
            }

            // Draw bullets...
            this.bullets.forEach(bullet => {
                ctx.drawImage(bullet.img, bullet.x, bullet.y, bullet.width, bullet.height);
            });
        },
        jumpPower: 15,
        gravity: 0.5,
        onGround: true,
    };

    function getEnemySpawnInterval(level, score) {
        if (level === 1) {
            return Math.max(1000, 3000 - Math.floor(score / 100) * 50);
        } else if (level === 2) {
            return Math.max(500, 2000 - Math.floor(score / 100) * 50);
        } else if (level === 3) {
            return Math.max(300, 1500 - Math.floor(score / 100) * 50);
        }
    }

    function getEnemySpawnCount(level, score) {
        if (level === 1) {
            return Math.ceil(Math.random() * (2 + Math.floor(score / 200)));
        } else if (level === 2) {
            return Math.ceil(Math.random() * (3 + Math.floor(score / 200)));
        } else if (level === 3) {
            return Math.ceil(Math.random() * (4 + Math.floor(score / 200)));
        }
    }

    function spawnEnemies() {
        const now = Date.now();
        if (now - lastEnemySpawnTime > enemySpawnInterval && !gameover && !paused) {
            enemySpawnInterval = getEnemySpawnInterval(level, score); // Difficulty scaling
            for (let i = 0; i < getEnemySpawnCount(level, score); i++) {
                let img = enemyImages[Math.floor(Math.random() * enemyImages.length)];
                enemies.push({
                    x: Math.random() * (canvas.width - 50),
                    y: -50,
                    width: 50,
                    height: 50,
                    img: img,
                    speed: Math.random() * 2 + 1,
                });
            }
            if (score >= 50 && !teamAppeared && level >= 2) {
                enemies.push({
                    x: Math.random() * (canvas.width - 600), // Adjust for team.png width
                    y: 0,
                    width: 600, // Set team.png width
                    height: 600, // Set team.png height
                    img: teamImg, // Use team.png image
                    speed: Math.random() + 0.5, // Team.png falling speed (adjusted for frequency)
                });
                teamAppeared = true;
            }
            lastEnemySpawnTime = now;
        }
    }

    function spawnPokes() {
        const now = Date.now();
        if (now - lastPokeSpawnTime > pokeSpawnInterval && !gameover && !paused) {
            pokes.push({
                x: Math.random() * (canvas.width - 30),
                y: -30,
                width: 30,
                height: 30,
                img: pokeImg,
                speed: 3, // Poke falling speed
            });
            lastPokeSpawnTime = now;
        }
    }

    function drawBackground() {
        ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    }

    function drawGround() {
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
    }

    function drawEnemies() {
        enemies.forEach(enemy => {
            enemy.y += enemy.speed;
            ctx.drawImage(enemy.img, enemy.x, enemy.y, enemy.width, enemy.height);
        });
        enemies = enemies.filter(enemy => enemy.y < canvas.height);
    }

    function drawPokes() {
        pokes.forEach(poke => {
            poke.y += poke.speed;
            ctx.drawImage(poke.img, poke.x, poke.y, poke.width, poke.height);
        });
        pokes = pokes.filter(poke => poke.y < canvas.height);
    }

    function displayCatchMessage() {
        if (catchMessageTimer > 0) {
            ctx.font = '20px Arial';
            ctx.fillStyle = 'lime';
            ctx.fillText('CATCH THEM ALL!', canvas.width / 2 - 100, 30); // Top center position
            catchMessageTimer--;
        }
    }

    function checkCollisions() {
        // Reset player touched state
        if (playerTouched) {
            setTimeout(() => {
                playerImg.src = originalPlayerImgSrc; // Reset player image
                playerTouched = false;
            }, 2000); // Reset player image after 2 seconds
        }

        enemies.forEach((enemy, eIndex) => {
            player.bullets.forEach((bullet, bIndex) => {
                if (bullet.x < enemy.x + enemy.width && bullet.x + bullet.width > enemy.x &&
                    bullet.y < enemy.y + enemy.height && bullet.y + bullet.height > enemy.y) {
                    score++;
                    enemies.splice(eIndex, 1);
                    player.bullets.splice(bIndex, 1);
                    scoreDisplay.innerText = `Score: ${score}`;
                    if (enemy.img.src.includes('team.png')) {
                        teamHealth--;
                        if (teamHealth <= 0) {
                            enemies = enemies.filter(e => !e.img.src.includes('team.png'));
                            teamAppeared = false;
                            teamHealth = 10; // Reset team health
                            score += 5; // Bonus for defeating team.png
                        }
                    }
                }
            });

            if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
                if (enemy.img.src.includes('enemy3.png')) {
                    lives -= 2; // Reduce 2 lives for enemy3 collision
                } else {
                    lives--;
                }
                enemies.splice(eIndex, 1);
                livesDisplay.innerText = `Lives: ${lives}`;
                if (lives <= 0) gameover = true;
                // Set player touched state and change image
                playerTouched = true;
                playerImg.src = 'images/head-touch.png';
            }
        });

        pokes.forEach((poke, pIndex) => {
            if (poke.x < player.x + player.width && poke.x + poke.width > player.x &&
                poke.y < player.y + player.height && poke.y + poke.height > player.y) {
                score += 5;
                pokes.splice(pIndex, 1);
                scoreDisplay.innerText = `Score: ${score}`;
                catchMessageTimer = 90; // Activate "CATCH THEM ALL!" message
            }
        });

        if (gameover) {
            ctx.font = '48px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText('GAME OVER', canvas.width / 2 - 150, canvas.height / 2 - 20);
            ctx.fillText(`Final Score: ${score}`, canvas.width / 2 - 150, canvas.height / 2 + 40);
            document.addEventListener('keydown', restartGame, { once: true });
            setTimeout(() => {
                pauseGame(5); // Pause for 5 seconds after game over
            }, 5000); // 5 seconds in milliseconds
        }
    }

    function update() {
        if (!gameover && !paused) {
            // Calculate elapsed time
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);

            // Update timer display
            timerDisplay.innerText = `Time: ${elapsedTime}`;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw background, ground, player, enemies, etc.
            drawBackground();
            drawGround();
            player.update();
            player.draw();
            spawnEnemies();
            drawEnemies();
            spawnPokes();
            drawPokes();
            displayCatchMessage();
            checkCollisions();

            // Request next frame
            requestAnimationFrame(update);

            // Check for level transitions
            if (score >= 50 && elapsedTime <= 60 && level === 1) {
                level = 2;
                backgroundImg.src = backgrounds[level - 1]; // Change background image for level 2
                difficultyDisplay.innerText = `Difficulty: Medium`;
                showMessage = true;
                setTimeout(() => {
                    showMessage = false;
                }, 3000); // Display "LEVEL 2 BRAVO" for 3 seconds
                mediumButton.classList.add('highlight');
                setTimeout(() => {
                    pauseGame(3); // Pause for 3 seconds between levels
                }, 3000); // 3 seconds in milliseconds
            } else if (score >= 100 && elapsedTime <= 120 && level === 2) {
                level = 3;
                backgroundImg.src = backgrounds[level - 1]; // Change background image for level 3
                difficultyDisplay.innerText = `Difficulty: Hard`;
                showMessage = true;
                setTimeout(() => {
                    showMessage = false;
                }, 3000); // Display "LEVEL 3 BRAVO" for 3 seconds
                hardButton.classList.add('highlight');
                setTimeout(() => {
                    pauseGame(3); // Pause for 3 seconds between levels
                }, 3000); // 3 seconds in milliseconds
            } else if (elapsedTime > 120 && level === 2) {
                gameover = true; // Player couldn't reach level 3 in time
            }
        }
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') player.dx = -player.speed;
        else if (e.key === 'ArrowRight') player.dx = player.speed;
        else if (e.key === ' ' && !gameover && !paused) player.shoot();
        else if (e.key === 'ArrowUp' && !gameover && player.onGround) jumping = true;
        else if (e.key.toLowerCase() === 'p') togglePause(); // Toggle game pause on 'P' key
        else if (e.key.toLowerCase() === 's') gameSound.muted = !gameSound.muted; // Toggle sound mute on 'S' key
        else if (e.key === 'Enter' && gameover) restartGame();
    });

    document.addEventListener('keyup', e => {
        if (e.key === 'ArrowLeft' && player.dx < 0) player.dx = 0;
        else if (e.key === 'ArrowRight' && player.dx > 0) player.dx = 0;
        if (e.key === 'ArrowUp') jumping = false;
    });

    function togglePause() {
        paused = !paused; // Toggle pause state
        if (paused) {
            gameSound.pause();
            // cancelAnimationFrame(update); // No need to cancel requestAnimationFrame, the game loop will check 'paused'
        } else {
            gameSound.playRandomPart();
            // update(); // No need to call update here since it's already looping
        }
    }

    function restartGame() {
        // Reset game variables
        score = 0;
        lives = 10;
        gameover = false;
        paused = false;
        showMessage = false;
        catchMessageTimer = 0;
        playerTouched = false;
        lastEnemySpawnTime = 0;
        enemySpawnInterval = 3000;
        lastPokeSpawnTime = 0;
        pokeSpawnInterval = 8000;
        enemies = [];
        pokes = [];
        jumping = false;
        jumpVelocity = 0;
        teamAppeared = false;
        teamHealth = 10;
        level = 1;
        startTime = Date.now(); // Reset start time

        // Reset background image
        backgroundImg.src = backgrounds[level - 1];

        // Reset UI elements
        scoreDisplay.innerText = `Score: ${score}`;
        livesDisplay.innerText = `Lives: ${lives}`;
        difficultyDisplay.innerText = `Difficulty: Easy`;
        easyButton.classList.add('highlight');
        mediumButton.classList.remove('highlight');
        hardButton.classList.remove('highlight');

        // Reset player position
        player.x = canvas.width / 2;
        player.y = canvas.height - groundHeight - player.height;
        player.dx = 0;
        player.dy = 0;
        player.bullets = [];
        player.onGround = true;
        jumpVelocity = 0;

        // Reset player image
        playerImg.src = originalPlayerImgSrc;

        // Restart game loop
        update();
    }

    function pauseGame(seconds) {
        paused = true; // Pause the game
        setTimeout(() => {
            paused = false; // Resume the game
            // update(); // No need to call update here since it's already looping
        }, seconds * 1000); // Convert seconds to milliseconds
    }

    // Start the game loop
    update();
});
