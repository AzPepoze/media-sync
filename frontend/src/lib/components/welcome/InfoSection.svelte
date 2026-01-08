<script lang="ts">
    import ExtensionGuide from "../ExtensionGuide.svelte";
</script>

<div class="about-section">
    <div class="about-container">
        <!-- How It Works Section -->
        <div class="how-it-works">
            <h2>How it works</h2>
            <div class="steps-grid">
                <div class="step-card">
                    <div class="step-number">1</div>
                    <h3>Create a Room</h3>
                    <p>Enter a unique Room ID or let us generate one for you. No account needed.</p>
                </div>
                <div class="step-card">
                    <div class="step-number">2</div>
                    <h3>Paste Any Link</h3>
                    <p>
                        Paste a <strong>video link or even a webpage URL</strong>. We will try to find the
                        video and play it for you.
                    </p>
                </div>
                <div class="step-card">
                    <div class="step-number">3</div>
                    <h3>Play Together</h3>
                    <p>
                        Share the Room ID with friends and watch detected videos perfectly synced in
                        real-time.
                    </p>
                </div>
            </div>
        </div>

        <!-- Features Grid -->
        <div class="about-grid">
            <div class="about-card">
                <div class="icon">🚀</div>
                <h3>Real-time Sync</h3>
                <p>
                    Experience seamless <strong>video playback with friends</strong>. Pause, seek, and play
                    are synchronized instantly for everyone to <strong>watch together</strong>.
                </p>
            </div>
            <div class="about-card">
                <div class="icon">🔍</div>
                <h3>Smart Media Detection</h3>
                <p>
                    Full support for <strong>YouTube, Twitch, HLS, and custom files</strong>. You can even
                    paste a <strong>webpage link</strong>, and our backend will attempt to find the video
                    source for you automatically.
                </p>
            </div>
            <div class="about-card">
                <div class="icon">💬</div>
                <h3>Private Watch Party</h3>
                <p>
                    Create your own private space. Just share the Room ID to start your <strong
                        >online watch party</strong
                    > in seconds.
                </p>
            </div>
        </div>

        <div class="project-info">
            <h2>About Media Sync</h2>

            <p>
                Media Sync is an open-source project designed to bring people together through shared media
                experiences. Built with modern technologies, it provides a lightweight and responsive interface
                for <strong>synchronized video watching</strong>.
            </p>

            <div class="tech-stack">
                <span>SvelteKit</span>
                <span>TypeScript</span>
                <span>Socket.io</span>
                <span>Node.js</span>
                <span>Express</span>
                <span>Vite</span>
                <span>Sass</span>
                <span>HLS.js</span>
                <span>Playwright</span>
                <span>yt-dlp</span>
                <span>Docker</span>
                <span>pnpm</span>
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    $bg-dark: #0f1115;
    $bg-panel: #181b21;
    $primary: #5865f2;
    $text-muted: #b9bbbe;

    .about-section {
        background-color: $bg-dark;
        padding: 6rem 2rem;
        position: relative;
        z-index: 2;
        border-top: 1px solid rgba(255, 255, 255, 0.05);

        .about-container {
            max-width: 1000px;
            margin: 0 auto;
        }

        .how-it-works {
            text-align: center;
            margin-bottom: 5rem;

            h2 {
                font-size: 2.5rem;
                color: white;
                margin-bottom: 3rem;
                font-weight: 800;
            }

            .steps-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 2rem;
            }

            .step-card {
                background: rgba(255, 255, 255, 0.03);
                padding: 2rem;
                border-radius: 15px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                transition: transform 0.3s;

                &:hover {
                    transform: translateY(-5px);
                    background: rgba(255, 255, 255, 0.05);
                }

                .step-number {
                    background: linear-gradient(135deg, $primary, darken($primary, 10%));
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 1.2rem;
                    color: white;
                    margin: 0 auto 1.5rem;
                    box-shadow: 0 4px 10px rgba($primary, 0.4);
                }

                h3 {
                    color: white;
                    margin-bottom: 0.8rem;
                    font-size: 1.3rem;
                }

                p {
                    color: $text-muted;
                    line-height: 1.5;
                }
            }
        }

        .about-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
            margin-bottom: 5rem;
        }

        .about-card {
            background: $bg-panel;
            padding: 2.5rem;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition:
                transform 0.3s,
                border-color 0.3s;

            &:hover {
                transform: translateY(-5px);
                border-color: rgba($primary, 0.3);
            }

            .icon {
                font-size: 2.5rem;
                margin-bottom: 1.5rem;
            }

            h3 {
                font-size: 1.5rem;
                color: white;
                margin-bottom: 1rem;
            }

            p {
                color: $text-muted;
                line-height: 1.6;

                strong {
                    color: lighten($primary, 10%);
                    font-weight: 600;
                }
            }
        }

        .project-info {
            text-align: center;
            background: linear-gradient(145deg, rgba($primary, 0.1), transparent);
            padding: 4rem;
            border-radius: 30px;
            border: 1px solid rgba($primary, 0.1);

            h2 {
                font-size: 2.5rem;
                color: white;
                margin-bottom: 1.5rem;
            }

            p {
                color: $text-muted;
                font-size: 1.1rem;
                line-height: 1.8;
                max-width: 800px;
                margin: 0 auto 2.5rem;

                strong {
                    color: white;
                }
            }

            .tech-stack {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 1rem;

                span {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                    padding: 0.5rem 1.2rem;
                    border-radius: 100px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
            }
        }
    }

    @media (max-width: 768px) {
        .about-section {
            padding: 4rem 1.5rem;

            .project-info {
                padding: 2rem 1rem;

                h2 {
                    font-size: 1.8rem;
                }
            }
        }
    }
</style>