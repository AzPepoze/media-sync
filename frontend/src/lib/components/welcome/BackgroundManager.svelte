<script lang="ts">
    import { onMount } from "svelte";

    // Background state
    let backgroundUrl = "";
    let backgroundPostId = "";
    let backgroundAuthor = "";
    let backgroundSource = "";
    let isBgLoading = false;
    let isBgReady = false;

    onMount(() => {
        fetchRandomBackground();
    });

    async function fetchRandomBackground() {
        isBgLoading = true;
        try {
            const targetUrl = `https://konachan.net/post.json?limit=1&tags=order:random+rating:safe`;
            const proxyUrl = `https://proxy.azpepoze.com/?url=${encodeURIComponent(targetUrl)}`;
            const res = await fetch(proxyUrl);
            const data = await res.json();

            if (data && data.length > 0) {
                const post = data[0];
                const imgUrl = post.sample_url || post.file_url;

                const img = new Image();
                img.src = imgUrl;
                img.onload = () => {
                    isBgReady = false;
                    setTimeout(() => {
                        backgroundUrl = imgUrl;
                        backgroundPostId = post.id;
                        backgroundAuthor = post.author;
                        backgroundSource = post.source;
                        isBgReady = true;
                        isBgLoading = false;
                    }, 100);
                };
                img.onerror = () => {
                    isBgLoading = false;
                };
            } else {
                isBgLoading = false;
            }
        } catch (e) {
            console.error("Failed to fetch background", e);
            isBgLoading = false;
        }
    }
</script>

<!-- Fullscreen Background Layer -->
<div
    class="background-layer"
    class:visible={isBgReady}
    style={backgroundUrl ? `background-image: url('${backgroundUrl}');` : ""}
></div>

<!-- Credits & Loading UI -->
{#if backgroundUrl || isBgLoading}
    <div class="bg-credits" class:loading={isBgLoading}>
        {#if isBgLoading}
            <div class="loading-state">
                <div class="spinner"></div>
                <span>Loading background...</span>
            </div>
        {:else}
            <div class="credit-row">
                <span class="source">Random background by Konachan</span>
                <button class="refresh-btn" on:click={fetchRandomBackground} title="Next Image">↻</button>
            </div>
            <a href={backgroundSource} target="_blank" class="download-link">Go to source</a>
        {/if}
    </div>
{/if}

<style lang="scss">
    $primary: #5865f2;
    
    .background-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        opacity: 0;
        transition: opacity 1.2s ease-in-out;
        z-index: 0;

        &.visible {
            opacity: 1;
        }
    }

    .bg-credits {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        z-index: 10;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.8);
        background: rgba(0, 0, 0, 0.6);
        padding: 0.5rem 0.8rem;
        border-radius: 6px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 120px;

        .loading-state {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.2rem 0;

            .spinner {
                width: 12px;
                height: 12px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
        }

        .credit-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .refresh-btn {
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 1rem;
            opacity: 0.8;
            transition: transform 0.3s;

            &:hover {
                transform: rotate(180deg);
                opacity: 1;
            }
        }

        .download-link {
            color: lighten($primary, 15%);
            text-decoration: none;
            font-weight: bold;

            &:hover {
                text-decoration: underline;
            }
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>