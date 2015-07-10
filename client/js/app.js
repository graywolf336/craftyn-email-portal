var app = angular.module('craftynEmailApp', ['ui.router', 'ui.bootstrap', 'ui-notification', 'textAngular', 'naif.base64', 'angular-loading-bar']);

app.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('email', {
        url: '/',
        abstract: true,
        template: '<ui-view />'
    }).state('email.login', {
        url: 'login',
        controller: 'LoginCtrl',
        templateUrl: '/templates/login.html',
        title: 'Login'
    }).state('email.emails', {
        url: 'emails',
        controller: 'EmailsCtrl',
        templateUrl: '/templates/emails.html',
        authRequired: true,
        title: 'Emails'
    }).state('email.new', {
        url: 'emails/new',
        controller: 'NewEmailCtrl',
        templateUrl: '/templates/newEmail.html',
        authRequired: true,
        title: 'New Email'
    }).state('email.users', {
        url: 'users',
        controller: 'UsersCtrl',
        templateUrl: '/templates/users.html',
        authRequired: true,
        title: 'Users'
    }).state('email.images', {
        url: 'images',
        controller: 'ImagesCtrl',
        templateUrl: '/templates/images.html',
        authRequired: true,
        title: 'Images'
    });

    $urlRouterProvider.when('', '/login');
    $urlRouterProvider.when('/', '/login');
    $urlRouterProvider.otherwise('/login');
}]);

app.run(['$rootScope', '$state', 'UserService', function($rootScope, $state, UserService) {
    $rootScope.title = 'Craftyn Email Portal';

    //currently there is a problem/bug with the way I have authenication
    //setup, if you access the spa via something otherthan /emails
    //you will be redirected to /emails if you're logged in. Not
    //cool but for now it is livable
    $rootScope.$on('$stateChangeStart', function(event, next, nextParams, previous, previousParams) {
        console.log(previous, next);
        if (next.authRequired && !UserService.isLoggedIn()) {
            event.preventDefault();
            $state.go('email.login');
        }else {
            if(next && next.title)
                $rootScope.title = next.title + ' | Craftyn Email Portal';
            else
                $rootScope.title = 'Craftyn Email Portal';
        }
    });
}]);

app.factory('UserService', ['$q', '$http', function($q, $http) {
    var user = {
        logged: false,
        username: 'Anonymous'
    };
    var users = [];

    return {
        isLoggedIn: function() {
            return user.logged;
        },
        getUser: function() {
            return user;
        },
        checkIfLoggedIn: function() {
            var deferred = $q.defer();

            if(user.logged) {
                deferred.reject({ message: 'Already logged in.' });
            }else {
                $http.get('/api/user').success(function(data) {
                    if(data.username === 'Anonymous') {
                        user.logged = false;
                        console.log('Not logged in.', data);
                    }else {
                        user.logged = true;
                        console.log('/api/user details:', data);
                    }

                    deferred.resolve(user);
                }).error(function(error) {
                    deferred.reject(error ? error : { message: 'An internal error occured, report this to graywolf336.' });
                });
            }

            return deferred.promise;
        },
        login: function(username, password) {
            var deferred = $q.defer();

            if(user.logged) {
                deferred.reject({ message: 'Already logged in.' });
            }else {
                $http.post('/api/user', {
                    username: username,
                    password: password
                }).success(function(data) {
                    user.logged = true;
                    console.log(data);
                    deferred.resolve(user);
                }).error(function(error) {
                    deferred.reject(error ? error : { message: 'An internal error occured, report this to graywolf336.' });
                });
            }

            return deferred.promise;
        },
        logout: function() {
            var deferred = $q.defer();

            if(user.logged) {
                $http.delete('/api/user').success(function(data) {
                    user.logged = false;
                    console.log(data);
                    user.username = 'Anonymous';
                    deferred.resolve(user)
                }).error(function(error) {
                    deferred.reject(error ? error : { message: 'An internal error occured, report this to graywolf336.' });
                });
            }else {
                deferred.reject({ message: 'Not logged in.' });
            }

            return deferred.promise;
        },
        getAll: function() {
            var deferred = $q.defer();

            if(users.length) {
                deferred.resolve(users);
            }else {
                $http.get('/api/users').success(function(data) {
                    users = data;
                    deferred.resolve(users)
                }).error(function(error) {
                    deferred.reject(error ? error : { message: 'An internal error occured, report this to graywolf336.' });
                });
            }

            return deferred.promise;
        }
    }
}]);

app.service('EmailService', ['$q', '$http', function($q, $http) {
    var emails = [];

    return {
        get: function() {
            var deferred = $q.defer();

            if(emails.length) {
                deferred.resolve(emails);
            }else {
                $http.get('/api/emails').success(function(data) {
                    angular.forEach(data, function(e) {
                        e.date = new Date(e.date);
                        emails.push(e);
                    });

                    deferred.resolve(emails);
                }).error(function(error) {
                    deferred.reject(error ? error : { message: 'An internal error occured while getting the emails, report this to graywolf336.' });
                });
            }

            return deferred.promise;
        },
        create: function(email) {
            var deferred = $q.defer();

            $http.post('/api/emails', email).success(function(data) {
                angular.forEach(data, function(e) {
                    e.date = new Date(e.date);
                    emails.push(e);
                });

                deferred.resolve(emails);
            }).error(function(error) {
                deferred.reject(error ? error : { message: 'An internal error occured while creating the email, report this to graywolf336.' });
            });

            return deferred.promise;
        },
        verify: function(email) {
            var deferred = $q.defer();

            //this is *not* optimal at all, just a quick check to verify
            //that the email object passed in contains all the required fields
            if(!email.body) deferred.reject({ message: 'No body object found, it is required.' });
            else if(!email.body.html || !email.body.html.trim()) deferred.reject({ message: 'No html body found, it is required.' });
            else if(!email.body.text || !email.body.text.trim()) deferred.reject({ message: 'No html body found, it is required.' });
            else if(!email.subject || !email.subject.trim()) deferred.reject({ message: 'The subject of the email not found, it is required.' });
            else deferred.resolve();

            return deferred.promise;
        }
    }
}]);

app.service('ImageService', ['$q', '$http', function($q, $http) {
    var images = {};

    return {
        get: function(name) {
            var defer = $q.defer();

            if(name && images[name]) {
                defer.resolve(images[name]);
            }else {
                $http.get(name ? '/images/' + name : '/images').success(function(data) {
                    if(data.name) {
                        images[data.name] = data;
                    }else {
                        angular.forEach(data, function(i) {
                            images[i.name] = i;
                        });

                        defer.resolve(images);
                    }
                }).error(function(error) {
                    defer.reject(error ? error : { message: 'An internal error occured, report this to graywolf336.' });
                });
            }

            return defer.promise;
        },
        create: function(details) {
            var defer = $q.defer();

            $http.post('/api/images/' + details.filename, details).success(function() {
                defer.resolve();
            }).error(function(error) {
                defer.reject(error ? error : { message: 'An internal error occured, report this to graywolf336.' });
            });

            return defer.promise;
        }
    }
}]);

app.controller('NavCtrl', ['$scope', '$state', 'Notification', 'UserService', function($scope, $state, Notification, UserService) {
    $scope.isCollapsed = true;
    $scope.user = UserService.getUser();

    UserService.checkIfLoggedIn();

    $scope.logout = function() {
        UserService.logout().then(function(data) {
            Notification.success('You have logged out successfully.');
            $state.go('email.login');
        }, function(error) {
            Notification.error(error);
        });
    }
}]);

app.controller('LoginCtrl', ['$scope', '$state', 'Notification', 'UserService', function($scope, $state, Notification, UserService) {
    $scope.loggedIn = UserService.isLoggedIn();
    $scope.busy = false;
    $scope.login = {};

    $scope.submit = function() {
        $scope.busy = true;
        UserService.login($scope.login.username, $scope.login.password).then(function(success) {
            $scope.busy = false;
            $state.go('email.emails');
        }, function(error) {
            console.log(error);
            Notification.error({ message: error.message, delay: 50000 });
            $scope.busy = false;
        });
    }

    if($scope.loggedIn) {
        $state.go('email.emails');
    }
}]);

app.controller('EmailsCtrl', ['$scope', '$state', '$http', '$interval', 'Notification', 'EmailService', function($scope, $state, $http, $interval, Notification, EmailService) {
    $scope.busy = true;
    $scope.emails = [];
    $scope.status = {};

    EmailService.get().then(function(data) {
        $scope.busy = false;
        console.log('Emails:', data);

        angular.forEach(data, function(e) {
            $scope.emails.push(e);
        });
    }, function(error) {
        $scope.busy = false;
        Notification.error(error);
    });

    $scope.addNewEmail = function() {
        $state.go('email.new')
    }

    $scope.action = function(email) {
        if(email.status === 'New') {
            email.status = 'In Progress';
            $http.put('/api/emails?id=' + email._id).success(function(status) {
                $scope.status = status;
                startStatus();
            }).error(function(error) {
                Notification.error(error);
            });
        }else {
            startStatus();
        }
    }

    var statusPromise;
    var startStatus = function() {
        if(!statusPromise) {
            statusPromise = $interval(function() {
                $http.get('/api/status/emails').success(function(status) {
                    if($scope.status.running === undefined) $scope.status = status;
                    $scope.status.running = status.running;
                    $scope.status.finished = status.finished;
                    $scope.status.errored = status.errored;
                    $scope.status.total = status.total;

                    if(!$scope.status.running && statusPromise) $interval.cancel(statusPromise);
                }).error(function(error) {
                    Notification.error(error);
                });
            }, 20000);
        }else {
            Notification.warning('Checking already started.');
        }
    };

    $scope.$on('destory', function() {
        if(statusPromise) $interval.cancel(statusPromise);
    });
}]);

app.controller('NewEmailCtrl', ['$scope', '$state', 'Notification', 'EmailService', function($scope, $state, Notification, EmailService) {
    $scope.busy = false;
    $scope.email = {
        body: {
            html: '<h1>Hi!</h1>',
            text: 'Hi!'
        },
        files: {
            attached: [],
            images: []
        },
        subject: 'Email'
    };

    $scope.submit = function() {
        if(!$scope.busy) {
            $scope.busy = true;
            EmailService.verify($scope.email).then(function() {
                EmailService.create($scope.email).then(function(emails) {
                    $state.go('email.emails');
                }, function(error) {
                    Notification.error(error);
                    $scope.busy = false;
                });
            }, function(invalidMessage) {
                console.log(invalidMessage);
                Notification.error(invalidMessage);
                $scope.busy = false;
            });
        }
    }
}]);

app.controller('UsersCtrl', ['$scope', '$interval', '$http', 'Notification', 'UserService', function($scope, $interval, $http, Notification, UserService) {
    $scope.busy = true;
    $scope.users = [];
    $scope.status = { running: false, finished: 0, errored: 0, total: 0 };

    function getAllUsers() {
        $scope.busy = true;
        UserService.getAll().then(function(users) {
            angular.forEach(users, function(u) {
                $scope.users.push(u);
            });
            $scope.busy = false;
        }, function(error) {
            console.log('Error while getting all the users:', error);
            Notification.error(error);
            $scope.busy = false;
        });
    }

    function getDownloadStatus() {
        $http.get('/api/status/users').success(function(details) {
            $scope.status.running = details.running;
            $scope.status.finished = details.finished;
            $scope.status.errored = details.errored;
            $scope.status.total = details.total;

            if(!$scope.status.running && statusPromise) $interval.cancel(statusPromise);
        }).error(function(error) {
            console.log('Error updating status:', error);
        });
    }

    $scope.performUserDownload = function() {
        if(!$scope.busy && !$scope.status.running) {
            $scope.busy = true;
            $http.get('/api/users/performDownload').then(function(details) {
                $scope.status.running = details.running;
                $scope.status.finished = details.finished;
                $scope.status.errored = details.errored;
                $scope.status.total = details.total;
                $scope.busy = false;
            }, function(error) {
                console.log('Error while performing user download:', error);
                if(error && error.message) Notification.error(error);
                else Notification.error({ message: 'Error while performing user download, report this to graywolf336.' });
                $scope.busy = false;
            });
        }
    }

    getAllUsers();
    getDownloadStatus();

    var statusPromise = $interval(getDownloadStatus, 20000);

    $scope.$on('destory', function() {
        if(statusPromise) $interval.cancel(statusPromise);
    });
}]);

app.controller('ImagesCtrl', ['$scope', '$modal', 'Notification', 'ImageService', function($scope, $modal, Notification, ImageService) {
    $scope.busy = true;
    $scope.images = {};

    var refreshImages = function() {
        ImageService.get().then(function(images) {
            $scope.images = images;
            $scope.busy = false;
        }, function(error) {
            if(error && error.message) Notification.error(error);
            else Notification.error({ message: 'Error while getting all the images, report this to graywolf336.' });
            $scope.busy = false;
        });
    }

    $scope.showUploadModal = function() {
        var modalInstance = $modal.open({
            templateUrl: '/templates/modals/upload-image.html',
            controller: 'UploadImageCtrl',
            size: 'lg'
        });

        modalInstance.result.then(function() {
            refreshImages();
        }, function () {
            console.info('Modal dismissed at: ' + new Date());
        });
    }

    refreshImages();
}]);

app.controller('UploadImageCtrl', ['$scope', '$modalInstance', 'Notification', 'ImageService', function($scope, $modalInstance, Notification, ImageService) {
    $scope.busy = false;
    $scope.file = {};

    $scope.upload = function() {
        if($scope.file.filename) {
            $scope.busy = true;
            ImageService.create($scope.file).then(function() {
                $modalInstance.dismiss();
            }, function(error) {
                if(error && error.message) Notification.error(error);
                else Notification.error({ message: 'Error while getting all the images, report this to graywolf336.' });
                $scope.busy = false;
            });
        }else {
            Notification.warning('No filename, please try another file.');
        }
    }

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    }
}]);
