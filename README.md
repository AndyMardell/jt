# jt
A dirty timer app with JIRA integration

## Installation
```bash
npm install -g
```

## Setup
Get started by running:

```bash
jt
```

As this is your first time running `jt`, you'll be asked a few setup questions.

## Usage
```bash
jt --help
```

### Start a Timer
To start a new task timer use:

```bash
jt start
```

You'll be asked to select a JIRA task or create a custom task. You'll then be asked how long ago you started the task.

### Finish a Timer
To finish a task timer use:

```bash
jt finish
```

If you're running multiple timers, you'll be asked which timer you'd like to end.

### List Timers
The following command will list timers that are currently active

```bash
jt list
```

## Updating
To update, pull the changes from github and reinstall:

```bash
git pull origin master
npm install -g
```
