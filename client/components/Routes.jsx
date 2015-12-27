const {
  IndexRedirect,
  Redirect,
  Route,
  Router,
} = ReactRouter;

const history = ReactRouter.history.useQueries(ReactRouter.history.createHistory)();

Routes = React.createClass({
  render() {
    return (
      <Router history={history}>
        {/* Authenticated routes */}
        <Route path="/" component={Authenticator} authenticated={true}>
          <IndexRedirect to="hunts"/>
          <Route path="" component={App}>
            <Route path="hunts/:huntId/puzzles/:puzzleId" component={PuzzlePage}/>
            <Route path="hunts/:huntId/puzzles" component={PuzzleListPage}/>
            {/* redirect to puzzle list until we have a hunt overview page or something */}
            <Redirect from="hunts/:huntId" to="hunts/:huntId/puzzles"/>
            <Route path="hunts" component={HuntList}/>
            <Route path="users">
              <Route path="invite" component={UserInvite}/>
            </Route>
            <Route path="sheets/:id" component={Spreadsheet}/>
          </Route>
        </Route>
        {/* Unauthenticated routes */}
        <Route path="/" component={Authenticator} authenticated={false}>
          <Route path="login" component={AccountsForm}/>
          <Route path="reset-password/:token" component={AccountsForm} state="resetPwd"/>
          <Route path="enroll/:token" component={AccountsForm} state="enrollAccount"/>
        </Route>
        {/* Routes available to both authenticated and unauthenticated users */}
      </Router>
    );
  },
});
