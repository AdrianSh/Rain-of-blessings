if (!typeof VOCABULARY) {
    window.VOCABULARY = {
        "Section I - Frequency Rank 1 to 20 (occ. 19783-913)": [
            { "greek": "αὐτός, -ή, -ό", "english": ["he", "she", "it", "himself", "herself", "itself", "even", "very", "same"], "detail": "(pron) he, she, it, himself, herself, itself; even, very; same" },
            { "greek": "γάρ", "english": ["for"], "detail": "(conj) for" }
        ]
    };
}

const startingSectionElm = document.getElementById('startingSection');
const startGameBtn = document.getElementById('startGameBtn');
const pauseGameBtn = document.getElementById('pauseGame');
const textInput = document.getElementById('text-input');
const learningHelperElm = document.getElementById('learningHelper');
const gameArea = document.getElementById('game-area');
const gameCanvas = document.getElementById('gameCanvas');

// Game Mode Buttons
const modeFallBtn = document.getElementById('modeFall');
const modeFlashcardBtn = document.getElementById('modeFlashcard');
const modePresentationBtn = document.getElementById('modePresentation');

// Option Inputs from Modal
const randomCheckboxElm = document.getElementById('randomWordOrder');
const randomSectionCheckboxElm = document.getElementById('randomSectionOrder');
const learningModeCheckboxElm = document.getElementById('learningMode');
const pronounceGreekCheckboxElm = document.getElementById('speak');
const learningModeDelayElm = document.getElementById('learningModeDelay');
const speedElm = document.getElementById('speed');


// --- Populate Vocabulary Sections ---
const vocSections = Object.getOwnPropertyNames(VOCABULARY);
vocSections.forEach(section => {
    const option = document.createElement('option');
    option.value = section;
    option.textContent = section;
    startingSectionElm.appendChild(option);
});

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

function showInteractiveUI() {
    learningHelperElm.classList.remove('d-none'); // Make the helper visible
    textInput.classList.remove('d-none');
    textInput.focus(); // Focus the input so the user can type
}

function hideInteractiveUI() {
    learningHelperElm.classList.add('d-none'); // Hide the helper
    learningHelperElm.innerHTML = ' '; // Clear its content
    textInput.classList.add('d-none'); // Hide the helper
    textInput.value = ''; // Clear its content
    textInput.blur(); // Unfocus the input
}

startGameBtn.addEventListener("click", function () {
    const collapseElementList = document.querySelectorAll('.collapse')
    const collapseList = [...collapseElementList].map(collapseEl => new bootstrap.Collapse(collapseEl, { toggle: false })).forEach(e => e.hide());

    // --- GAME CONFIGURATION ---
    const wordSize = gameCanvas.width > 700 ? 40 : 25;

    // Reset Quintus if it exists
    reset();

    // Setup the game engine
    window.Q = Quintus()
        .include("Sprites, Scenes, Input, UI, Touch")
        .setup("gameCanvas", {
            width: gameArea.clientWidth,
            height: gameArea.clientHeight,
            maximize: false,
            wrapper: gameArea
        })
        .controls(false).untouch();

    Q.input.drawButtons = function () { }; // No-op to prevent drawing touch buttons

    function reset() {
        if (typeof window.Q != 'undefined') {
            Q.clearStages();
            if (Q.loop) {
                window.cancelAnimationFrame(Q.loop);
                Q.loop = null;
            }
            Q.reset();
            if (textInput) textInput.value = "";
        }
    }

    // Helper functions inside game scope
    function pickWord(section, wordNumber = 0) {
        return VOCABULARY[section][wordNumber];
    }

    function randomWordNumber(section, wordNumber) {
        if (randomCheckboxElm.checked || randomSectionCheckboxElm.checked) {
            const words = VOCABULARY[section];
            wordNumber = Math.floor(Math.random() * words.length);
        }
        console.debug('Selected word: ', wordNumber);
        return wordNumber;
    }

    function pickNewSection(stage, sectionIndex) {
        startingSectionElm.selectedIndex = sectionIndex;
        stage.options.vocSectionNum = sectionIndex || 0;
        stage.options.vocSection = startingSectionElm.value || vocSections[stage.options.vocSectionNum];
        stage.options.numWordsInSection = countWords(stage.options.vocSection);
        stage.options.wordNumber = randomWordNumber(stage.options.vocSection, 0);
        console.debug('Selected section: ', stage.options.vocSectionNum);
        textInput.focus();
    }

    function nextWordOrSection(stage) {
        if (randomSectionCheckboxElm.checked) {
            stage.options.vocSectionNum = Math.floor(Math.random() * vocSections.length);
            pickNewSection(stage, stage.options.vocSectionNum);
        } else {
            stage.options.wordNumber = randomWordNumber(stage.options.vocSectionNum, ++stage.options.wordNumber);
            if (stage.options.wordNumber >= stage.options.numWordsInSection) {
                if ((stage.options.vocSectionNum + 1) < vocSections.length) {
                    stage.options.vocSectionNum++;
                    pickNewSection(stage, stage.options.vocSectionNum);
                } else {
                    Q.stageScene("endGame", 1, { score: stage.options.score, msg: "Game Conquered!" });
                }
            } else {
                stage.options.wordNumber = randomWordNumber(stage.options.vocSection, stage.options.wordNumber);
            }
        }
    }

    function countWords(section) {
        return VOCABULARY[section].length;
    }

    // --- SPRITE DEFINITION: The Falling Word ---
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
        },
        step: function (dt) {
            this.p.y += this.p.vy * dt;
            if (this.p.labelElement) { this.p.labelElement.p.x = this.p.x; this.p.labelElement.p.y = this.p.y; }
            if (this.p.y > Q.height) { this.stage.trigger("loseLife"); if (this.p.labelElement) this.p.labelElement.destroy(); this.destroy(); }
        }
    });

    Q.UI.Text.extend("FlashcardUI", {
        init: function (p) {
            this._super(p, {
                label: p.greek,
                x: Q.width / 2,
                y: Q.height / 2,
                color: typeColors[p.wordType] || typeColors['default'],
                size: 60
            });
        },
        draw: function (ctx) {
            this._super(ctx);
        }
    });


    // --- Custom UI Sprite for rendering wrapped text ---
    Q.UI.Text.extend("WrappedText", {
        init: function (p) {
            this._super(p, {
                lineHeight: 1.2,
                align: 'center',
                textBaseline: 'top',
                color: p.color || "#000",
                font: p.font || "Arial",
                size: p.size || 24,
                family: p.family || "Arial",
                w: p.w || Q.width * 0.9
            });
        },
        draw: function (ctx) {
            if (!this.p.label) return;
            ctx.save();
            ctx.font = `${this.p.size}px ${this.p.family}`;
            ctx.fillStyle = this.p.color;
            ctx.textAlign = this.p.align;
            ctx.textBaseline = 'alphabetic';
            const lines = this.wrapText(ctx, this.p.label.toString(), this.p.w);
            const fontHeight = this.p.size;
            const totalHeight = lines.length * fontHeight * this.p.lineHeight;
            let startX = 0;
            let startY = 0 - (totalHeight / 2);
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

    // --- SCENE DEFINITION: The Main Game Level ---
    Q.scene("level1", function (stage) {
        function handleSectionChange() {
            if (startingSectionElm.selectedIndex != stage.options.vocSectionNum) {
                pickNewSection(stage, startingSectionElm.selectedIndex);
            }
        }
        startingSectionElm.addEventListener('change', handleSectionChange);
        stage.on('destroy', () => startingSectionElm.removeEventListener('change', handleSectionChange));

        const isPresentationMode = modePresentationBtn.classList.contains('active');
        const isFlashcardMode = modeFlashcardBtn.classList.contains('active');
        // Fall mode is the default if the others aren't active
        const isFallMode = modeFallBtn.classList.contains('active');

        // Common stage setup
        stage.options.score = 0;
        stage.options.lives = learningModeCheckboxElm.checked ? 200 : 3;
        stage.options.initialWordSpeed = parseInt(speedElm.value) || 100;
        stage.options.wordSpeed = stage.options.initialWordSpeed;
        stage.options.isWordAnswered = false;

        pickNewSection(stage, startingSectionElm.selectedIndex);

        textInput.value = "";
        textInput.disabled = false;
        pauseGameBtn.innerText = '||';

        const scoreLabel = stage.insert(new Q.UI.Text({ x: 80, y: 30, label: "Score: 0", color: "#34495e", size: 24, align: 'left' }));
        const livesLabel = stage.insert(new Q.UI.Text({ x: Q.width - 80, y: 30, label: `Lives: ${stage.options.lives}`, color: "#34495e", size: 24, align: 'right' }));

        // Universal function to display word context
        const displayWordContext = (wordData) => {
            // From the spelling try to recover the audio...
            if (wordData.spelling) {
                const wordSpelling = wordData.spelling.replaceAll('-', '_').toLowerCase();
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
                Q.el.style.backgroundImage = 'none';
            }
            const wordType = extractWordType(wordData);
            if (wordData.contextTextGreek) {
                learningHelperElm.innerHTML = boldSelectedWord(wordData.contextTextGreek, wordData.greek.split(', ')[0], wordType);
            } else {
                learningHelperElm.innerHTML = `<span class="word">${boldSelectedWord(wordData.greek, wordData.greek, wordType)}</span>`;
            }
            return wordType;
        };


        //=====================================================================
        // MODE 1: PRESENTATION FLASHCARDS (NON-INTERACTIVE)
        //=====================================================================
        if (isPresentationMode) {
            hideInteractiveUI();
            scoreLabel.p.hidden = true;
            livesLabel.p.hidden = true;

            stage.state = { timer: 0, phase: 'new_word', wordData: null, delay: parseInt(learningModeDelayElm.value, 10) };

            stage.on('step', function (dt) {
                if (isPaused) return;
                const state = this.state;
                state.timer += dt * 1000;
                state.delay = parseInt(learningModeDelayElm.value, 10);

                if (state.phase === 'new_word') {
                    Q("PresentationUI").destroy();
                    state.wordData = pickWord(this.options.vocSection, this.options.wordNumber);
                    if (!state.wordData) {
                        Q.stageScene("endGame", 1, { score: this.options.score, msg: "Lesson Complete!" });
                        this.pause(); // Stop the scene
                        return;
                    }

                    const wordType = displayWordContext(state.wordData);
                    this.insert(new Q.UI.Text({
                        label: state.wordData.greek, x: Q.width / 2, y: Q.height / 2 - 50, size: 60,
                        color: typeColors[wordType] || typeColors['default'], className: 'PresentationUI'
                    }));
                    state.phase = 'show_answer';
                    state.timer = 0;
                }
                else if (state.phase === 'show_answer' && state.timer > state.delay) {
                    this.insert(new Q.WrappedText({
                        label: state.wordData.detail, x: Q.width / 2, y: Q.height / 2 + 50, size: 40,
                        color: '#34495e', w: Q.width * 0.8, className: 'PresentationUI'
                    }));

                    let audioDelay = 0;
                    // From the spelling try to recover the audio...
                    if (state.wordData.spelling) {
                        const wordSpelling = state.wordData.spelling.replaceAll('-', '_');
                        if (pronounceGreekCheckboxElm.checked) {
                            const audio = new Audio(`audio/${wordSpelling}back.mp3`);
                            audioDelay = (parseInt(audio.duration) || 0) * 1000;
                            audio.play().catch(e => console.warn(`Audio file for "${wordSpelling}" not found or could not be played.`, e));
                        }
                    }
                    state.phase = 'wait';
                    state.timer = (audioDelay > 0 ? audioDelay + 3000 : 0) * -1;
                }
                else if (state.phase === 'wait' && state.timer > state.delay) {
                    this.options.wordNumber++;
                    if (this.options.wordNumber >= this.options.numWordsInSection) {
                        if ((this.options.vocSectionNum + 1) < vocSections.length) {
                            this.options.vocSectionNum++;
                            pickNewSection(this, this.options.vocSectionNum);
                        } else {
                            state.wordData = null; // To trigger end condition
                        }
                    }
                    state.phase = 'new_word';
                    state.timer = 0;
                    this.items.forEach(e => this.remove(e));
                }
            });
        }
        //=====================================================================
        // MODE 2: INTERACTIVE FLASHCARDS
        //=====================================================================
        else if (isFlashcardMode) {
            showInteractiveUI();
            livesLabel.p.hidden = true;

            const spawnFlashcard = () => {
                Q("FlashcardUI").destroy();
                const wordData = pickWord(stage.options.vocSection, stage.options.wordNumber);
                const wordType = displayWordContext(wordData);
                const flashcard = stage.insert(new Q.FlashcardUI({
                    greek: wordData.greek,
                    wordType,
                    contextTextGreek: wordData.contextTextGreek,
                    spelling: wordData.spelling
                }));
                flashcard.p.english = wordData.english;
                flashcard.p.detail = wordData.detail;
                textInput.value = "";
            };

            const handleFlashcardInput = () => {
                if (isPaused) return;
                const flashcard = Q("FlashcardUI").first();
                if (!flashcard) return;
                const inputValue = textInput.value.trim().toLowerCase();
                const isCorrect = Array.isArray(flashcard.p.english)
                    ? flashcard.p.english.some(answer => answer.toLowerCase() === inputValue)
                    : flashcard.p.english.toLowerCase() === inputValue;

                if (isCorrect) {
                    flashcard.destroy();
                    const newLabelText = "✓ " + flashcard.p.label + " " + flashcard.p.detail;
                    const feedback = stage.insert(new Q.WrappedText({
                        label: newLabelText, x: Q.width / 2, y: Q.height / 2, color: '#2ecc71', size: wordSize, w: Q.width * 0.85, className: 'FlashcardUI'
                    }));

                    // textInput.disabled = true;
                    textInput.value = "";

                    // From the spelling try to recover the audio...
                    if (flashcard.p.spelling) {
                        const wordSpelling = flashcard.p.spelling.replaceAll('-', '_').toLowerCase();
                        if (pronounceGreekCheckboxElm.checked) {
                            const audio = new Audio(`audio/${wordSpelling}back.mp3`);
                            audio.play().catch(e => console.warn(`Audio file for "${wordSpelling}back" not found or could not be played.`, e));
                        }
                    }

                    setTimeout(() => {
                        feedback.destroy();
                        stage.trigger("correctAnswer");
                        textInput.disabled = false;
                    }, parseInt(learningModeDelayElm.value));
                } else if (learningModeCheckboxElm.checked) {
                    const helper = `<span class="detail">${boldSelectedWord(flashcard.p.greek, flashcard.p.greek, flashcard.p.wordType)}   ${flashcard.p.detail}</span>`;
                    if (flashcard.p.contextTextGreek) {
                        learningHelperElm.innerHTML = boldSelectedWord(flashcard.p.contextTextGreek, flashcard.p.greek.split(', ')[0], flashcard.p.wordType) + '<br />' + helper;
                    } else {
                        learningHelperElm.innerHTML = helper;
                    }
                }
            };

            textInput.addEventListener('input', handleFlashcardInput);
            stage.on('destroy', () => textInput.removeEventListener('input', handleFlashcardInput));

            stage.on("correctAnswer", () => {
                scoreLabel.p.label = `Score: ${++stage.options.score}`;
                nextWordOrSection(stage);
                spawnFlashcard();
            });

            spawnFlashcard();
        }
        //=====================================================================
        // MODE 3: FALLING WORDS (DEFAULT)
        //=====================================================================
        else {
            showInteractiveUI();

            const spawnWord = () => {
                if (stage.options.lives <= 0) return;
                stage.options.isWordAnswered = false;

                if (!learningModeCheckboxElm.checked) {
                    nextWordOrSection(stage);
                }

                const wordData = pickWord(stage.options.vocSection, stage.options.wordNumber);
                const wordType = displayWordContext(wordData);

                stage.insert(new Q.Word({
                    greek: wordData.greek,
                    english: wordData.english, // This is now an array!
                    detail: wordData.detail || "",
                    spelling: wordData.spelling,
                    vy: stage.options.wordSpeed,
                    wordType: wordType,
                    contextTextGreek: wordData.contextTextGreek
                }));
            };

            const handleInput = () => {
                if (isPaused || stage.options.isWordAnswered) return;
                const word = Q("Word").first();
                if (!word) return;
                const inputValue = textInput.value.trim().toLowerCase();
                // If `english` is an array, check if any match
                const isCorrect = Array.isArray(word.p.english)
                    ? word.p.english.some(answer => answer.toLowerCase() === inputValue)
                    : word.p.english.toLowerCase() === inputValue;

                if (isCorrect) {
                    stage.options.isWordAnswered = true;

                    // From the spelling try to recover the audio...
                    if (word.p.spelling) {
                        const wordSpelling = word.p.spelling.replaceAll('-', '_').toLowerCase();
                        if (pronounceGreekCheckboxElm.checked) {
                            const audio = new Audio(`audio/${wordSpelling}back.mp3`);
                            audio.play().catch(e => console.warn(`Audio file for "${wordSpelling}back" not found or could not be played.`, e));
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
                    }, learningModeCheckboxElm.checked ? learningModeDelayElm.value || 2000 : 600);
                } else if (learningModeCheckboxElm.checked) {
                    const helper = `<span class="detail">${boldSelectedWord(word.p.greek, word.p.greek, word.p.wordType)}   ${word.p.detail}</span>`;
                    if (word.p.contextTextGreek) {
                        learningHelperElm.innerHTML = boldSelectedWord(word.p.contextTextGreek, word.p.greek.split(', ')[0], word.p.wordType) + '<br />' + helper;
                    } else {
                        learningHelperElm.innerHTML = helper;
                    }
                }
            };

            textInput.addEventListener('input', handleInput);
            stage.on('destroy', () => { textInput.removeEventListener('input', handleInput); });

            stage.on("loseLife", () => {
                livesLabel.p.label = `Lives: ${--stage.options.lives}`;
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

                if (learningModeCheckboxElm.checked) {
                    nextWordOrSection(stage);
                }

                spawnWord();

                if (stage.options.score > (stage.options.numWordsInSection + 10)) {
                    console.debug('Score above num. of words: ' + stage.options.score);
                    if ((stage.options.vocSectionNum + 1) < vocSections.length) {
                        ++stage.options.vocSectionNum;
                        pickNewSection(stage, stage.options.vocSectionNum);
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
        }

        const focusInput = () => textInput.focus();
        Q.el.addEventListener('click', focusInput);
        stage.on('destroy', () => { Q.el.removeEventListener('click', focusInput); });
    });

    // --- SCENE DEFINITION: Game Over Screen ---
    Q.scene("endGame", function (stage) {
        Q.el.style.backgroundImage = 'none';
        textInput.disabled = true; textInput.value = "";
        const container = stage.insert(new Q.UI.Container({ x: Q.width / 2, y: Q.height / 2, fill: "rgba(44, 62, 80, 0.85)", radius: 10 }));
        container.insert(new Q.UI.Text({ x: 0, y: -80, color: "white", size: 60, label: stage.options.msg || "Game Over" }));
        container.insert(new Q.UI.Text({ x: 0, y: 0, color: "white", size: 24, label: `Final Score: ${stage.options.score}` }));
        const button = container.insert(new Q.UI.Button({ x: 0, y: 80, fill: "#3498db", label: "Play Again", fontColor: "white", size: 20, py: 15, px: 30 }));
        button.on("click", () => { Q.clearStages(); startGameBtn.click(); });
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

    startGame(); // Start the game when button is clicked
});

function resizeGame() {
    gameCanvas.width = gameArea.clientWidth;
    gameCanvas.height = gameArea.clientHeight;
    if (typeof window.Q != 'undefined') {
        console.debug('Restarting game after resizing...');
        startGameBtn.dispatchEvent(new Event('click'));
    }
}

function throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

const throttledFunction = throttle(() => {
    resizeGame();
    console.debug("Executed at most once every 1000ms.");
}, 1000);

resizeGame();
// window.addEventListener('resize', throttledFunction);