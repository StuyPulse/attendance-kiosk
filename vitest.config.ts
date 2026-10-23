const config = {
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup-ui.ts"],
        include: ["test/components/**/*.test.tsx"],
    },
};

export default config;

