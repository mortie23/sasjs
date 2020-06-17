export const isAuthorizeFormRequired = (response: string) => {
  return /<form.+action="(.*Logon\/oauth\/authorize[^"]*).*>/gm.test(response);
};
