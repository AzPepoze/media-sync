<script lang="ts">
    import { onMount } from "svelte";
    import { joinRoom, SERVER_URL } from "../../stores/socket";

    export let nickname = "";
    export let roomId = "";

    onMount(() => {
        const savedNick = localStorage.getItem("nickname");
        if (savedNick) nickname = savedNick;

        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get("room_id");
        if (roomParam) roomId = roomParam;
    });

    function handleJoin() {
        if (!nickname.trim()) return;

        if (!roomId.trim()) {
            roomId = Math.random().toString(36).substring(2, 8);
        }

        joinRoom(roomId, nickname);
    }

    async function generateRandomId() {
        let isUnique = false;
        let newId = "";
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            newId = Math.random().toString(36).substring(2, 8);
            try {
                const apiUrl = `${SERVER_URL}/check-room/${newId}`;

                const res = await fetch(apiUrl);
                const data = await res.json();
                if (!data.exists) {
                    isUnique = true;
                }
            } catch (e) {
                isUnique = true;
            }
            attempts++;
        }
        roomId = newId;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" && nickname.trim()) {
            handleJoin();
        }
    }
</script>

<div class="form-card">
    <h2>Welcome</h2>
    <p class="subtitle">Enter your name and room ID to start watching together</p>

    <div class="input-group">
        <label for="nick">Nickname</label>
        <input
            id="nick"
            type="text"
            bind:value={nickname}
            placeholder="Enter your nickname"
            on:keydown={handleKeydown}
        />
    </div>

    <div class="input-group">
        <label for="room">Room ID</label>
        <div class="room-input-wrapper">
            <input
                id="room"
                type="text"
                bind:value={roomId}
                placeholder="Custom ID or leave blank for random"
                on:keydown={handleKeydown}
            />
            <button class="random-btn" on:click={generateRandomId} title="Generate random ID">
                🎲
            </button>
        </div>
    </div>

    <div class="actions">
        <button class="join-btn" on:click={handleJoin} disabled={!nickname}>
            {roomId ? "Join / Create Room" : "Create Random Room"}
        </button>
    </div>
</div>

<style lang="scss">
    $text-main: #ffffff;
    $text-muted: #b9bbbe;
    $primary: #5865f2;
    $primary-hover: #4752c4;

    .form-card {
        width: 100%;
        max-width: 420px;
        padding: 2.5rem;
        background: rgba(24, 27, 33, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        margin: 0 auto;

        @media (max-width: 480px) {
            padding: 1.5rem;
            border-radius: 16px;
        }

        @media (max-width: 350px) {
            padding: 1rem;
        }

        h2 {
            font-size: 2rem;
            color: $text-main;
            margin-bottom: 0.5rem;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .subtitle {
            color: $text-muted;
            margin-bottom: 2.5rem;
            font-size: 1rem;
        }

        .input-group {
            margin-bottom: 1.5rem;

            label {
                display: block;
                margin-bottom: 0.5rem;
                color: $text-muted;
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
            }

            input {
                width: 100%;
                padding: 1rem;
                background: rgba(32, 34, 37, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: $text-main;
                font-size: 1rem;
                box-sizing: border-box;
                transition: all 0.2s;

                &:focus {
                    outline: none;
                    border-color: $primary;
                    background-color: rgba(32, 34, 37, 0.9);
                }
            }

            .room-input-wrapper {
                display: flex;
                gap: 0.5rem;
                width: 100%;

                input {
                    flex: 1;
                    min-width: 0; /* Prevents input from pushing flex container */
                }

                .random-btn {
                    background: rgba(32, 34, 37, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: $text-main;
                    padding: 0 1rem;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover {
                        background: rgba(64, 68, 75, 0.8);
                    }
                }
            }
        }

        .actions {
            margin-top: 1.5rem;
        }

        .join-btn {
            width: 100%;
            padding: 1rem;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            background: $primary;
            color: white;
            transition: all 0.2s;

            &:hover:not(:disabled) {
                background: $primary-hover;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba($primary, 0.4);
            }

            &:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        }
    }
</style>