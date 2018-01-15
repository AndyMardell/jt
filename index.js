#!/usr/bin/env node
var program = require('commander');
var toTime = require('to-time');
var inquirer = require('inquirer');
var jsonfile = require('jsonfile');
var humanTime = require('human-time');
var prettyMs = require('pretty-ms');
var moment = require('moment');
var Client = require('node-rest-client').Client;
client = new Client();

const os = require('os');
const uuidV4 = require('uuid/v4');

var tasksFile = '.jt-tasks.json';
var timersFile = '.jt-timers.json';
var optionsFile = '.jt-options.json';

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

var tasks = [];
var timers = [];
var options = [];

var searchArgs = {
    headers: {
        // Set the cookie from the session information
        cookie: '',
        "Content-Type": "application/json"
    },
    data: {
        // Provide additional data for the JIRA search. You can modify the JQL to search for whatever you want.
        jql: "order by lastViewed DESC",
        fields: [
            "summary"
        ],
        maxResults: 100,
        startAt: 0
    }
    
};

var startQuestions = [
    {
        type: 'autocomplete',
        name: 'task',
        message: 'Select a task to create a timer for',
        source: function(answersSoFar, input) {
            return searchTasks(input);
        }
    },
    {
        type: 'input',
        name: 'backfill',
        message: "How long ago did you start this task? (Hit enter for 'now')",
        default: '0m',
        validate: function(value) {
            if (validateTime(value) !== false) {
                return true;
            }
            return 'Sorry I could not understand your time. Try 1.25h, or 45m.';
        }
    }
];

var finishQuestions = [
    {
        type: 'list',
        name: 'timer',
        message: 'Select a timer to finish',
        choices: function() {
            var tidyTimers = [];
            var filteredTimers = timers.filter(hasNotFinished);
            for(var i = 0; filteredTimers.length > i; i++) {
                var row = filteredTimers[i];
                tidyTimers.push({
                    name: row.task + ' - Started ' + humanTime(new Date(row.start)), 
                    value: row.id
                });
            }
            return  tidyTimers;
        }
    },
]

var customTaskQuestions = [
    {
        type: 'input',
        name: 'name',
        message: "What is the custom task?",
        default: 'Untitled'
    }
]

var newSetupQuestions = [
    {
        type: 'confirm',
        name: 'useJira',
        message: "Would you like to use JIRA integration?"
    }
]

var jiraSetupQuestions = [
    {
        type: 'input',
        name: 'url',
        message: "What is your JIRA url? (e.g. jenjinstudios.atlassian.net)",
        default: 'sidigital.atlassian.net'
    },
    {
        type: 'input',
        name: 'username',
        message: "What is your JIRA username?",
        default: 'admin'
    },
    {
        type: 'password',
        name: 'password',
        message: "What is your JIRA password? (This will not be stored)",
        default: ''
    }
]

// Returns a Promise which will handle array searches
var searchTasks = function(input) {
    return new Promise(function(resolve) {
        var search = Object.assign([], tasks);
        if(input !== null) {
            search = tasks.filter(filter(input));
        }
        
        search.push({
            value: '.jt-custom',
            name: 'Custom task..'
        });
        
        resolve(search);
    });
}

// Reduces array results using regexp
function filter(input) {
    return function(task) {
        return new RegExp(input, 'i').exec(task.name) !== null;
    };
}

var hasNotFinished = function(timer) {
    return (timer['end'] === undefined);
}

var hasFinished = function(timer) {
    return (timer['end'] !== undefined);
}

var startedToday = function(timer) {
    var start = timer['start'],
        startDate = moment(start).format('DDMMYYYY'),
        today = moment().format('DDMMYYYY');
    if (startDate == today) {
        return true;
    }
    return false;
}

var endedToday = function(timer) {
    var end = timer['end'],
        endDate = moment(end).format('DDMMYYYY'),
        today = moment().format('DDMMYYYY');
    if (endDate == today) {
        return true;
    }
    return false;
}

var endedYesterday = function(timer) {
    var end = timer['end'],
        endDate = moment(end).format('DDMMYYYY'),
        yesterday = moment().add(-1, 'days').format('DDMMYYYY');
    if (endDate == yesterday) {
        return true;
    }
    return false;
}

// Ensures that time matches the human readable format in the to-time module
var validateTime = function(time) {
    if(time !== '') {
        try {
            return toTime(time).seconds();
        } catch (err) {
            return false;
        }
    }
    return true;
}

// Populated local variables from files in the user's home directory
var checkFiles = function() {
    return new Promise(function(resolve) {
        loadFile(tasksFile)
        .then(function(data) {
            if(data == false) {
                tasks = []
            } else {
                tasks = data;
            }
            
            return loadFile(timersFile)
        })
        .then(function(data) {
            if(data == false) {
                timers = []
            } else {
                timers = data;
            }
            return loadFile(optionsFile)
        })
        .then(function(data) {
            if(data == false) {
                options = {}
            } else {
                options = data;
            }
            if(options.session !== undefined ) {
                searchArgs.headers.cookie = options.session
            }
            resolve();
        });
    });
};

// Returns objects from JSON files. Creates the file if it's mising.
var loadFile = function(file) {
    return new Promise(function(resolve, error) {
        var fileToRead = [os.homedir(), file].join('/');
        jsonfile.readFile(fileToRead, function(err, obj) {
            if(err) {
                jsonfile.writeFile(fileToRead, [], { flag: "w+" }, function(err, obj) {
                    if(err) {            
                        return error(err);
                    } else {
                        return resolve(false);
                    }
                });
            } else {
                return resolve(obj);
            }
        });
    });
}

var writeToFile = function(file, data) {
    return new Promise(function(resolve, error) {
        var fileToRead = [os.homedir(), file].join('/');
        jsonfile.writeFile(fileToRead, data, { flag: "w+" }, function(err, obj) {
            if(err) {            
                return error(err);
            } else {
                return resolve();
            }
        });
    })
}

var updateFiles = function() {
    return new Promise(function(resolve, error) {
        writeToFile(tasksFile, tasks)
        .then(function() {
            return writeToFile(timersFile, timers);
        })
        .then(function() {
            return writeToFile(optionsFile, options);
        })
        .then(function() {
            return resolve();
        })
    })
}

var findTaskNameById = function(id) {
    for(var i = 0; i < tasks.length; i++) {
        if(tasks[i].value === id) {
            return tasks[i].name;
        }
    }
}

var findTimerById = function(id) {
    for(var i = 0; i < timers.length; i++) {
        if(timers[i].id === id) {
            return timers[i];
        }
    }
}

var runJiraSetup = function() {
    return new Promise(function(resolve) {
        inquirer.prompt(jiraSetupQuestions)
        .then(function(credentials) {
            console.log("Testing credentials. Just a moment!");

            var loginArgs = {
                data: {
                    "username": credentials.username,
                    "password": credentials.password
                },
                headers: {
                    "Content-Type": "application/json"
                } 
            };
            
            client.post(["https://", credentials.url, "/rest/auth/1/session"].join(''), loginArgs, function(data, response){
                if (response.statusCode == 200) {
                    console.log("Logged in! Storing session cookie for future requests.")
                    options.loggedIn = true;
                    options.session = data.session;
                    searchArgs.headers.cookie =  data.session.name + '=' + data.session.value,
                    updateFiles()
                    .then(function() {
                        return resolve();
                    })
                } else {
                    console.log("Sorry, they didn't work. Please try again.")
                    runJiraSetup()
                    .then(resolve);
                }
            });
        })
    });
}

var getTasks = function(startFrom) {
    
    searchArgs.data.startAt = startFrom;

    // Make the request return the search results, passing the header information including the cookie.
    return new Promise(function(resolve) {
        client.post("https://sidigital.atlassian.net/rest/api/2/search", searchArgs, function(searchResult, response) {
            if(response.statusCode == 200) {
                for(var i = 0; i < searchResult.issues.length; i++) {
                    tasks.push({ 
                        value: searchResult.issues[i].key, 
                        name: [searchResult.issues[i].key, searchResult.issues[i].fields.summary].join(' - ')
                    });
                }
                resolve(searchResult);
            }
        });
    });
}

var syncTasks = function() {
    return new Promise(function(resolve) {
        client.post("https://sidigital.atlassian.net/rest/api/2/search", searchArgs, function(searchResult, response) {
            if(response.statusCode == 200) {
                console.log("Syncing tasks...")
                tasks = [];
                var promises = [];
                for(var i = 0; i < searchResult.total; i = i+100) {
                    promises.push(getTasks(i));
                }
                Promise.all(promises)
                .then(updateFiles)
                .then(function() {
                    return resolve();
                })
            } else {
                console.log("Error");
                return resolve();
            }
        });
    })
    
}



var runSetup = function() {
    return new Promise(function(resolve) {
        console.log("Welcome to jt! A handy little CLI timer with JIRA integration")
        console.log("To get started, lets go through a few setup questions...")
        inquirer.prompt(newSetupQuestions).then(resolve);
       
    })
    .then(function(answers) {
        if(answers !== undefined && answers.useJira == true) {
            options.useJira = true;
            return runJiraSetup();
        } else {
            options.useJira = false;
            return;
        }
    })
    .then(function() {
        return new Promise(function(resolve) {
            if(options.useJira == true && options.loggedIn == true) {
                syncTasks()
                .then(resolve)
            } else {
                return resolve();
            }
        })
    })
    .then(answers => {
        options.setup = true
        updateFiles();
    });
}

// Define CLI commands and options
program
.command('start')
.description('Start a new task timer')
.action(function(options){
    inquirer.prompt(startQuestions).then(function(answers, resolve, error) {
        return new Promise(function(resolve) {
            if(answers.task == '.jt-custom') {
                return inquirer.prompt(customTaskQuestions).then(function(customAnswers) {
                    answers.task = customAnswers.name 
                    resolve(answers);
                });
            } else {
                answers.task = findTaskNameById(answers.task)
                resolve(answers);
            }
        })
    }).then(answers => {
        var backfillMilliseconds = toTime(answers.backfill).milliseconds();
        var startTime = new Date(Date.now() - (backfillMilliseconds));

        timers.push({
            task: answers.task,
            start: startTime,
            id: uuidV4()
        });

        console.log("Starting task", answers.task, '-', humanTime(startTime))
        updateFiles();
    });
});


program
.command('list')
.description('List currently active timers')
.action(function(options){
    var activeTimers = timers.filter(hasNotFinished)
    if(activeTimers.length == 0) {
        return console.log("No active timers found");
    }

    console.log('Active tasks:')
    for(var i = 0; i < activeTimers.length; i++) {
        console.log(activeTimers[i].task, '-', humanTime(new Date(activeTimers[i].start)))
    }
});


program
.command('log')
.option('-t --time [time]', 'Time', /^(today|yesterday)$/i)
.description('Show task log')
.action(function(options){
    var allTimers = timers.filter(hasFinished),
        todaysTimers = timers.filter(startedToday),
        yesterdaysTimers = timers.filter(endedYesterday)
        timePeriod = options.time,
        subTotal = 0,
        dayLength = 28800000;
    if(allTimers.length == 0) {
        return console.log("No timers found");
    }

    if (timePeriod == 'today') {

        if (todaysTimers.length == 0) {
            return console.log("You haven\'t worked on anything yet");
        }
        console.log("Tasks you have been working on today:")
        for(var i = 0; i < todaysTimers.length; i++) {

            var taskStart = new Date(todaysTimers[i].start);

            // If still in progress, mark as in progress
            if (!todaysTimers[i].end) {
                var taskDuration = new Date() - taskStart;
                console.log(todaysTimers[i].task, '-', prettyMs(taskDuration, {verbose: true}), '<- In Progress');
            } else {
                var taskEnd = new Date(todaysTimers[i].end),
                    taskDuration = taskEnd - taskStart;
                console.log(todaysTimers[i].task, '-', prettyMs(taskDuration, {verbose: true}));
            }
            subTotal = subTotal + taskDuration;

        }
        console.log("Total: ", prettyMs(subTotal, {verbose: true}));
        console.log("You still need to work for", prettyMs(dayLength - subTotal, {verbose: true}));

    } else if (timePeriod == 'yesterday') {

        if (yesterdaysTimers.length == 0) {
            return console.log("You didn\'t work on anything yesterday");
        }
        console.log("Tasks you were working on yesterday:")
        for(var i = 0; i < yesterdaysTimers.length; i++) {
            var taskStart = new Date(yesterdaysTimers[i].start),
                taskEnd = new Date(yesterdaysTimers[i].end),
                taskDuration = taskEnd - taskStart;
            subTotal = subTotal + taskDuration;
            console.log(yesterdaysTimers[i].task, '-', prettyMs(taskDuration, {verbose: true}));
        }
        console.log("Total: ", prettyMs(subTotal, {verbose: true}));

    } else {

        console.log("All tasks you have been working on:")
        for(var i = 0; i < allTimers.length; i++) {

            var taskStart = new Date(allTimers[i].start);

            // If still in progress, mark as in progress
            if (!allTimers[i].end) {
                var taskDuration = new Date() - taskStart;
                console.log(allTimers[i].task, '-', prettyMs(taskDuration, {verbose: true}), '<- In Progress');
            } else {
                var taskEnd = new Date(allTimers[i].end),
                    taskDuration = taskEnd - taskStart;
                console.log(allTimers[i].task, '-', prettyMs(taskDuration, {verbose: true}));
            }
            subTotal = subTotal + taskDuration;
        }
        console.log("Total: ", prettyMs(subTotal, {verbose: true}));

    }
});


program
.command('finish')
.description('Finish a task')
.action(function(options){
    var activeTimers = timers.filter(hasNotFinished)
    if(activeTimers.length == 0) {
        return console.log("No active timers found");
    }

    inquirer.prompt(finishQuestions).then(answers => {
        var timer = findTimerById(answers.timer);
        if(timer == undefined) {
            return console.log("Can't find the timer!")
        }
        timer.end = new Date();
        updateFiles();
        return console.log("Stopped timer for", timer.task);
    });
});

// Kick off checkFiles, which ensures the timer and task files are present
checkFiles()
.then(function() {
    return new Promise(function(resolve) {
        if(options.setup == undefined || options.setup == false) {
            runSetup().then(resolve);
        } else {
            resolve();
        }
    })
    
})
.then(function() {
    // Handle CLI
    program.parse(process.argv);

    if (!process.argv.slice(2).length) {
        program.outputHelp();
    }
})

