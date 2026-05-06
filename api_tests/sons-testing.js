fetch("http://localhost:3000/sons")
  .then(res => {
    console.log(res.status);
    return (res.json());
  });

fetch("http://localhost:3000/sons/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "email": "ApiTest@test.com",
    "password": "password",
    "name": "ApiTest",
    "surname": "Test",
    "dateOfBirth": "2000-01-01",
    "address": {
      "city": "Paris",
      "country": "France",
      "voivodeship": "France",
      "longitude": "2.3522",
      "latitude": "48.8566"
    },
    "aboutYou": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed tincidunt nisl eget sodales eleifend. Nullam justo eros, condimentum eu varius quis, rhoncus ac leo. In ipsum metus, viverra nec ante vitae, aliquam porttitor orci. Integer tincidunt nec justo vel pellentesque. Vestibulum malesuada, erat vitae fermentum aliquet, ligula ante accumsan augue.",
    "images": [],
    "job": {
      "position": "septic tank driver",
      "location": {
        "city": "Paris",
        "country": "France",
        "voivodeship": "France",
        "longitude": "2.3522",
        "latitude": "48.8566"
      },
      "companyName": "Septic tank company"
    },
    "education": {
      "schoolName": "Stanford",
      "educationLevel": "MBA",
      "field": "IT"
    },
    "organizations": [],
    "hobbies": ["K-pop", "anime"],
    "socialMedia": [
      {
        "website": "Facebook",
        "url": "https://www.facebook.com/timotheechalamet95/",
      },
      {
        "website": "Instagram",
        "url": "https://www.instagram.com/tchalamet/",
      }
    ]
  })
}).then(res => {
  console.log(res.status);
  return (res.json());
});

await fetch("http://localhost:3000/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    username: "ApiTest@test.com",
    password: "password"
  })
})
  .then(res => res.json())
  .then(console.log);