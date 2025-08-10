module.exports = {
  apps: [{
    name: "queue-server",
    script: "server.js",
    env: {
      PORT: 3000,
      EXAM_CODE: "1234"
    }
  }]
}