if (!typeof VOCABULARY) {
    window.VOCABULARY = {
        "Section I - Frequency Rank 1 to 20 (occ. 19783-913)": [
            { "greek": "αὐτός, -ή, -ό", "english": ["he", "she", "it", "himself", "herself", "itself", "even", "very", "same"], "detail": "(pron) he, she, it, himself, herself, itself; even, very; same" },
            { "greek": "γάρ", "english": ["for"], "detail": "(conj) for" }
        ]
    };
}

const startingSectionElm = document.getElementById('startingSection');
const vocSections = Object.getOwnPropertyNames(VOCABULARY);
vocSections.forEach(section => {
    const option = document.createElement('option');
    option.value = section;        // Set the value (what gets submitted)
    option.textContent = section;  // Set the label (what user sees)
    startingSectionElm.appendChild(option);
});

function pickNewSection(sectionIndex) {
    startingSectionElm.selectedIndex = sectionIndex;
}

/**
    n - noun
    v - verb
    adj - adjective
    adv - adverb
    prep - preposition
    conj - conjunction
    pron - pronoun
    art - article
    interrog - interrogative
    intj - interjection
    m - masculine
    f - feminine
    n - neuter
 */
const typeColors = {
    'n': '#3d69ab',
    'adj': '#3eaded',
    'pron': '#61a387',
    'conj': '#ffba26',
    'prep': '#bd7e4b',
    'v': '#c75e82',
    'adv': '#ffc4dd',
    'art': '#8a00dc',
    'interrog': '#b80000',
    'interj': '#ffdf53',
    'default': '#2c3e50'
};

function extractWordsInParentheses(input) {
    const regex = /\(([^)]+)\)/g; // Match anything inside parentheses
    const matches = [...input.matchAll(regex)]; // Get all matches
    return matches
        .map(match => match[1].trim()) // Extract content inside parentheses
        .filter(content => /^[a-z]+$/i.test(content)) || []; // Only keep alphabetic strings like 'v', 'n', 'adj'
}

function extractWordType(wordData) {
    const type = extractWordsInParentheses(wordData.detail);
    return type && type.length > 0 && typeColors.hasOwnProperty(type[0]) ? type[0] : '';
}

function boldSelectedWord(text, word, type) {
    return text.replaceAll(word, `<b style="color: ${type ? typeColors[type] : typeColors['default']};">${word}</b>`);
}

const startGameBtn = document.getElementById('startGameBtn');
const pauseGameBtn = document.getElementById('pauseGame');

const gameCanvasContainer = document.getElementById('game-container');
const gameCanvas = document.getElementById('gameCanvas');
gameCanvas.width = gameCanvasContainer.clientWidth;
gameCanvas.height = gameCanvasContainer.clientHeight;

const learningModeCheckboxElm = document.getElementById('learningMode');
const pronounceGreekCheckboxElm = document.getElementById('speak');
const learningHelperElm = document.getElementById('learningHelper');

startGameBtn.addEventListener("click", function () {
    const collapseElementList = document.querySelectorAll('.collapse')
    const collapseList = [...collapseElementList].map(collapseEl => new bootstrap.Collapse(collapseEl, { toggle: false })).forEach(e => e.hide());

    learningModeCheckboxElm.dispatchEvent(new Event("click"));

    // --- GAME CONFIGURATION ---
    const wordSize = gameCanvas.width > 700 ? 40 : 25;

    // --- HTML ELEMENT REFERENCES ---
    const textInput = document.getElementById('text-input');
    const randomCheckboxElm = document.getElementById('randomWordOrder');
    const randomSectionCheckboxElm = document.getElementById('randomSectionOrder');
    const speedElm = document.getElementById('speed');
    const learningHelperElm = document.getElementById('learningHelper');
    const learningModeDelayElm = document.getElementById('learningModeDelay');

    if(typeof window.Q != 'undefined'){
        // Step 1: Clear all stages and sprites/UI
        Q.clearStages();

        // Step 2: Stop the game loop
        if (Q.loop) {
            window.cancelAnimationFrame(Q.loop);
            Q.loop = null;
        }

        // Step 3: Reset global game state
        Q.reset();

        // Step 4: Clean up DOM event listeners (adjust based on your code)
        if (textInput) {
            textInput.value = "";
        }
    }

    // --- SETUP THE GAME ---
    window.Q = Quintus()
        .include("Sprites, Scenes, Input, UI, Touch")
        .setup("gameCanvas", {
            width: gameCanvasContainer.clientWidth,
            height: gameCanvasContainer.clientHeight,
            maximize: false
        })
        .controls(false).touch();


    function pickNewWord(section, wordNumber = 0) {
        let sSection = section;

        const words = VOCABULARY[sSection];

        return (randomCheckboxElm.checked && !learningModeCheckboxElm.checked) || wordNumber >= words.length ?
            words[Math.floor(Math.random() * words.length)]
            : words[wordNumber];
    }

    function countWords(section) {
        const words = VOCABULARY[section];
        return words.length;
    }

    // --- SPRITE DEFINITION: The Falling Word (Unchanged) ---
    Q.Sprite.extend("Word", {
        init: function (p) {
            this._super(p, {
                x: Q.width * 0.2 + Math.random() * (Q.width * 0.6),
                y: -30,
                vy: 100,
                ...p
            });
            this.p.label = this.p.wordType && this.p.wordType != 'default' ? `${this.p.greek}    (${this.p.wordType})` : this.p.greek;
            this.on("inserted", this, "drawLabel");
        },
        drawLabel: function () {
            const color = typeColors[this.p.wordType] || typeColors['default'];
            this.p.labelElement = this.stage.insert(new Q.UI.Text({
                label: this.p.label,
                x: this.p.x,
                y: this.p.y,
                color: color,
                size: wordSize
            }));
            // this.p.labelElement.p.font = "1rem Arial";
        },
        step: function (dt) {
            this.p.y += this.p.vy * dt;
            if (this.p.labelElement) { this.p.labelElement.p.x = this.p.x; this.p.labelElement.p.y = this.p.y; }
            if (this.p.y > Q.height) { this.stage.trigger("loseLife"); if (this.p.labelElement) this.p.labelElement.destroy(); this.destroy(); }
        }
    });


    // --- NEW FEATURE: Custom UI Sprite for rendering wrapped text ---
    Q.UI.Text.extend("WrappedText", {
        init: function (p) {
            this._super(p, {
                lineHeight: 1.2,
                align: 'center',
                textBaseline: 'top', // Better for manual vertical alignment
                color: p.color || "#000",
                font: p.font || "Arial",
                size: p.size || 24,
                family: p.family || "Arial",
                w: p.w || Q.width * 0.9 // Default wrap width
            });
        },
        draw: function (ctx) {
            if (!this.p.label) return;

            ctx.save();

            // Set font and styles
            ctx.font = `${this.p.size}px ${this.p.family}`;
            ctx.fillStyle = this.p.color;
            ctx.textAlign = this.p.align;
            ctx.textBaseline = 'alphabetic'; // Standard baseline

            // Wrap the text
            const lines = this.wrapText(ctx, this.p.label.toString(), this.p.w);
            const fontHeight = this.p.size;
            const totalHeight = lines.length * fontHeight * this.p.lineHeight;

            // Start Y from center minus half height
            let startX = 0;
            let startY = 0 - (totalHeight / 2);

            // Draw each line
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], startX, startY + (i * fontHeight * this.p.lineHeight));
            }

            ctx.restore();
        },
        wrapText: function (context, text, maxWidth) {
            const words = text.split(' ');
            let lines = [];
            let currentLine = '';

            for (let word of words) {
                const testLine = currentLine + word + ' ';
                const { width } = context.measureText(testLine);
                if (width > maxWidth && currentLine !== '') {
                    lines.push(currentLine.trim());
                    currentLine = word + ' ';
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine.trim()) lines.push(currentLine.trim());

            return lines;
        }
    });

    // --- SPRITE TO RENDER TYPED INPUT (FIXED) ---
    Q.Sprite.extend("InputDisplay", {
        init: function (p) {
            this._super(p, { x: Q.width / 2, y: Q.height - 40, label: "", type: 0 });
            this.p.label = this.p.greek;
            this.on("inserted", this, "drawLabel");
        },

        // --- FIX #1: THE STEP METHOD ---
        // By adding a 'step' method, we tell Quintus to run this sprite's logic
        // on every single frame, which forces it to be redrawn constantly.
        // This is what makes the typed input visible and update live.
        step: function (dt) {
            this.p.label = textInput.value;
        },

        draw: function (ctx) {
            ctx.font = "1rem Arial";
            ctx.textAlign = "center";
            const currentWord = Q("Word").first();
            if (!currentWord) return;

            const targetText = currentWord.p.english;
            const typedText = this.p.label;
            const fullTextWidth = ctx.measureText(typedText).width;
            let startX = this.p.x - (fullTextWidth / 2);

            ctx.textAlign = 'left'; // Set alignment for character-by-character drawing
            for (let i = 0; i < typedText.length; i++) {
                const char = typedText[i];
                if (i < targetText.length && char.toLowerCase() === targetText[i].toLowerCase()) {
                    ctx.fillStyle = "#27ae60"; // Green for correct
                } else {
                    ctx.fillStyle = "#c0392b"; // Red for incorrect
                }
                ctx.fillText(char, startX, this.p.y);
                startX += ctx.measureText(char).width;
            }
        }
    });

    // --- SCENE DEFINITION: The Main Game Level ---
    Q.scene("level1", function (stage) {
        stage.options.score = 0;
        stage.options.lives = learningModeCheckboxElm.checked ? 200 : 3;
        stage.options.vocSectionNum = startingSectionElm.selectedIndex || 0;
        stage.options.vocSection = startingSectionElm.value || vocSections[stage.options.vocSectionNum];
        pickNewSection(stage.options.vocSectionNum);
        stage.options.numWordsInSection = countWords(stage.options.vocSection);
        stage.options.initialWordSpeed = parseInt(speedElm.value) || 100;
        stage.options.wordSpeed = stage.options.initialWordSpeed;
        stage.options.isWordAnswered = false;
        stage.options.wordNumber = 0;

        textInput.value = "";
        textInput.disabled = false;
        textInput.focus();

        const scoreLabel = stage.insert(new Q.UI.Text({ x: 80, y: 30, label: "Score: 0", color: "#34495e", size: 24, align: 'left' }));
        const livesLabel = stage.insert(new Q.UI.Text({ x: Q.width - 80, y: 30, label: `Lives: ${stage.options.lives}`, color: "#34495e", size: 24, align: 'right' }));
        // const inputDisplay = stage.insert(new Q.InputDisplay());

        const spawnWord = () => {
            if (stage.options.lives <= 0) return;
            stage.options.isWordAnswered = false;

            if (!learningModeCheckboxElm.checked && randomSectionCheckboxElm.checked) {
                stage.options.vocSectionNum = Math.floor(Math.random() * vocSections.length);
                stage.options.vocSection = vocSections[stage.options.vocSectionNum];
                pickNewSection(stage.options.vocSectionNum);
            }

            const wordData = learningModeCheckboxElm.checked ?
                pickNewWord(stage.options.vocSection, stage.options.wordNumber)
                : pickNewWord(stage.options.vocSection, ++stage.options.wordNumber); // You can change this dynamically later

            // From the spelling try to recover the audio...
            if (wordData.spelling) {
                const wordSpelling = wordData.spelling.replaceAll('-', '_');
                if (pronounceGreekCheckboxElm.checked) {
                    const audio = new Audio(`audio/${wordSpelling}.mp3`);
                    audio.play().catch(e => console.warn(`Audio file for "${wordSpelling}" not found or could not be played.`, e));
                }
                /*
                // Try to render an image...
                const canvasEl = Q.el;
                const imageUrl = `img/${wordSpelling}.png`;
                canvasEl.style.backgroundImage = `url('${imageUrl}')`;
                canvasEl.style.backgroundSize = "cover";
                canvasEl.style.backgroundPosition = "center center";
                */
            } else {
                // If there's no word, clear the background.
                Q.el.style.backgroundImage = 'none';
            }

            const wordType = extractWordType(wordData);
            if(wordData.contextTextGreek){
                learningHelperElm.innerHTML = boldSelectedWord(wordData.contextTextGreek, wordData.greek.split(', ')[0], wordType);
            } else {
                learningHelperElm.innerHTML = `<span class="word">${boldSelectedWord(wordData.greek, wordData.greek, wordType)}</span>`;
            }

            console.debug(`New word with speed: ${stage.options.wordSpeed}: ${wordData.greek}`);
            stage.insert(new Q.Word({
                greek: wordData.greek,
                english: wordData.english, // This is now an array!
                detail: wordData.detail || "",
                vy: stage.options.wordSpeed,
                wordType: wordType,
                contextTextGreek: wordData.contextTextGreek
            }));
        };

        const handleInput = () => {
            if (isPaused) return;
            if (stage.options.isWordAnswered) return;
            const word = Q("Word").first();

            if (!word) return;

            const inputValue = textInput.value.trim().toLowerCase();

            // If `english` is an array, check if any match
            const isCorrect = Array.isArray(word.p.english)
                ? word.p.english.some(answer => answer.toLowerCase() === inputValue)
                : word.p.english.toLowerCase() === inputValue;

            if (isCorrect) {
                stage.options.isWordAnswered = true;
                if (learningModeCheckboxElm.checked) {
                    ++stage.options.wordNumber;

                    if (randomSectionCheckboxElm.checked) {
                        stage.options.vocSectionNum = Math.floor(Math.random() * vocSections.length);
                        stage.options.vocSection = vocSections[stage.options.vocSectionNum];
                        pickNewSection(stage.options.vocSectionNum);
                    }
                }

                word.p.vy = 0;

                // --- MODIFICATION: Use the new WrappedText for correct answers ---
                if (word.p.labelElement) word.p.labelElement.destroy();
                const newLabelText = "✓ " + word.p.greek + " " + word.p.detail;

                // Replace the old label with our new, self-wrapping one
                word.p.labelElement = stage.insert(new Q.WrappedText({
                    label: newLabelText,
                    x: 0,
                    y: 0,
                    color: '#2ecc71',
                    size: wordSize,
                    w: Q.width * 0.85 // ← Add this!
                }));

                word.p.x = Q.width / 2;
                word.p.y = Q.height / 2;

                // textInput.disabled = true;
                textInput.value = "";

                setTimeout(() => {
                    if (word.p.labelElement) word.p.labelElement.destroy();
                    word.destroy();
                    stage.trigger("correctAnswer");
                    textInput.disabled = false;
                    textInput.focus();
                }, learningModeCheckboxElm.checked ? learningModeDelayElm.value || 2000 : 600);
            } else if (learningModeCheckboxElm.checked) {
                const helper = `<span class="detail">${boldSelectedWord(word.p.greek, word.p.greek, word.p.wordType)}   ${word.p.detail}</span>`;
                if(word.p.contextTextGreek){
                    learningHelperElm.innerHTML = boldSelectedWord(word.p.contextTextGreek, word.p.greek.split(', ')[0], word.p.wordType) + '<br />' + helper;
                } else {
                    learningHelperElm.innerHTML = helper;
                }
            }
        };

        textInput.addEventListener('input', handleInput);
        stage.on('destroy', () => { textInput.removeEventListener('input', handleInput); });

        // --- FIX #2: CLEARING THE INPUT ---
        stage.on("loseLife", () => {
            livesLabel.p.label = `Lives: ${--stage.options.lives}`;

            // This clears the input field when you miss a word.
            textInput.value = "";

            if (stage.options.lives <= 0) {
                Q.stageScene("endGame", 1, { score: stage.options.score });
            } else {
                spawnWord();
            }
        });

        stage.on("correctAnswer", () => {
            scoreLabel.p.label = `Score: ${++stage.options.score}`;
            if (!learningModeCheckboxElm.checked) {
                stage.options.wordSpeed += 1;
                speedElm.value = stage.options.wordSpeed;
            }
            spawnWord();

            if (stage.options.score > (stage.options.numWordsInSection + 10)) {
                console.debug('Score above num. of words: ' + stage.options.score);
                if ((stage.options.vocSectionNum + 1) < vocSections.length) {
                    ++stage.options.vocSectionNum;
                    stage.options.vocSection = vocSections[stage.options.vocSectionNum];
                    pickNewSection(stage.options.vocSectionNum);
                    stage.options.accumulatedScore = (stage.options.accumulatedScore || 0) + stage.options.score;
                    stage.options.score = 0;
                    stage.options.wordSpeed = stage.options.initialWordSpeed; // Restore speed
                    stage.options.lives += 3; // Restore lives and sumup the previous
                    console.info('New section!' + stage.options.numWordsInSection);
                } else {
                    Q.stageScene("endGame", 1, { score: stage.options.accumulatedScore, msg: "Game conquered!" });
                }
            } else {
                console.debug('Score: ' + stage.options.score + ', words in section: ' + stage.options.numWordsInSection);
            }
        });

        spawnWord();
        // Add a click listener to the whole canvas to re-focus the hidden input
        Q.el.addEventListener('click', () => textInput.focus());
        stage.on('destroy', () => { Q.el.removeEventListener('click', () => textInput.focus()); });
        setTimeout(() => textInput.focus(), 0);
    });

    // --- SCENE DEFINITION: Game Over Screen ---
    Q.scene("endGame", function (stage) {
        Q.el.style.backgroundImage = 'none';
        textInput.disabled = true; textInput.value = "";
        const container = stage.insert(new Q.UI.Container({ x: Q.width / 2, y: Q.height / 2, fill: "rgba(44, 62, 80, 0.85)", radius: 10 }));
        container.insert(new Q.UI.Text({ x: 0, y: -80, color: "white", size: 60, label: stage.options.msg || "Game Over" }));
        container.insert(new Q.UI.Text({ x: 0, y: 0, color: "white", size: 24, label: `Final Score: ${stage.options.score}` }));
        const button = container.insert(new Q.UI.Button({ x: 0, y: 80, fill: "#3498db", label: "Play Again", fontColor: "white", size: 20, py: 15, px: 30 }));
        button.on("click", () => { Q.clearStages(); Q.stageScene("level1"); });
        container.fit(40, 40);
    });

    Q.scene("pauseScene", function (stage) {
        const container = stage.insert(new Q.UI.Container({
            x: Q.width / 2, y: Q.height / 2, fill: "rgba(0,0,0,0.5)"
        }));
        const button = container.insert(new Q.UI.Button({
            x: 0, y: 0, fill: "#CCCCCC", label: "Paused"
        }));
        container.fit(20);
    });


    let originalGameLoopCallback = null;
    let isPaused = false;


    function pauseGame() {
        if (isPaused) return;

        // Save the original game loop callback
        originalGameLoopCallback = Q.gameLoopCallbackWrapper;

        // Replace with a dummy function to freeze updates
        Q.gameLoopCallbackWrapper = function () { };

        isPaused = true;
    }

    function resumeGame() {
        if (!isPaused) return;

        // Restore the original game loop
        if (originalGameLoopCallback) {
            Q.gameLoopCallbackWrapper = originalGameLoopCallback;
        }

        // Force-restart the game loop manually
        Q.lastGameLoopFrame = new Date().getTime();
        Q.loop = window.requestAnimationFrame(Q.gameLoopCallbackWrapper);

        isPaused = false;
    }

    pauseGameBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeGame();
            Q.clearStage(1); // remove pause scene
            pauseGameBtn.innerText = '||';
        } else {
            pauseGame();
            Q.stageScene("pauseScene", 1);
            pauseGameBtn.innerText = 'Resume';
        }
    });

    function startGame() {
        // --- LOAD THE GAME ---
        Q.clearStages(); // Clear any existing scenes
        Q.stageScene("level1"); // Start the game scene
    }

    function resizeGame() {
        const canvas = Q.el;
        canvas.width = gameCanvasContainer.clientWidth;
        canvas.height = gameCanvasContainer.clientHeight;
        Q.width = gameCanvasContainer.clientWidth;
        Q.height = gameCanvasContainer.clientHeight;
    }

    window.addEventListener('resize', resizeGame);
    resizeGame(); // Initial call


    startGame(); // Start the game when button is clicked
});