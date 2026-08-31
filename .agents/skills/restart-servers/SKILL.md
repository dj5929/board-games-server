---
name: restart-servers
description: >-
  Use this skill when the user asks to restart all running servers, kill all currently running servers, or spawn fresh servers.
---

# Restart Servers

This skill guides you through killing all running server processes and spawning fresh instances of the backend and frontend servers.

## Steps

1. Use the `manage_task` tool with Action `list` to view all currently running background tasks.
2. For any task that appears to be a server or dev process (like Vite, Fastify, or Node), use the `manage_task` tool with Action `kill` to terminate it.
3. To ensure no zombie processes are holding onto required ports, run the following command using the `run_command` tool (Set `WaitMsBeforeAsync` to a low value like 2000):
   ```powershell
   Stop-Process -Name node, vite -Force -ErrorAction SilentlyContinue
   ```
4. Start the **Backend Server** using `run_command`:
   - Command: `npx tsx src/server.ts`
   - Cwd: `d:\Projects\BoardGameServer\packages\server`
   - IsDaemon: true
5. Start the **Web Client (Frontend)** dev server using `run_command`:
   - Command: `npm run dev`
   - Cwd: `d:\Projects\BoardGameServer\packages\web-client`
   - IsDaemon: true
6. Confirm to the user that all servers have been successfully killed and spawned fresh.
