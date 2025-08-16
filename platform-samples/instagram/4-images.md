# Instagram - 4 Images Note

- Latest snapshot at: 2025-08-16
- HTML From URL: https://www.instagram.com/p/DNVQCFmSyz4/
- In a multiple image post, it will display as a carousel (with <ul><li> structure) and only 1 image will show at a time. The HTML was captured when the URL initiated, so it's showing "first" image of the post.
- This post has 4 images in total
- It's a bit complicated for multiple image post on Instagram, so we're going to explain step-by-step below
  - Step 1: we're at the first image, the first image's <li> is like this
    ```html
    <li class="_acaz" tabindex="-1" style="transform: translateX(0px);">
    ```
    and the image inside is like this
    ```html
    <img alt="Photo shared by EJ on August 14, 2025 tagging @muiiswim, and @pura__ej. 可能是 1 人、吉普車、汽車、戶外和文字的圖像." class="x5yr21d xu96u03 x10l6tqk x13vifvy x87ps6o xh8yej3" crossorigin="anonymous" src="https://scontent-tpe1-1.cdninstagram.com/v/t51.2885-15/532037768_18520081834015515_2211677656387455050_n.jpg?stp=dst-jpg_e35_tt6&amp;efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjEzNjV4MTgxOS5zZHIuZjgyNzg3LmRlZmF1bHRfaW1hZ2UuYzIifQ&amp;_nc_ht=scontent-tpe1-1.cdninstagram.com&amp;_nc_cat=103&amp;_nc_oc=Q6cZ2QG23T1gCANo088KwmtZ-byMt2CYOEW8MtBvauzxMHVwNM8c4ol4xGwtct2fRsCPdeY&amp;_nc_ohc=F0y0ekFwF34Q7kNvwGPwulI&amp;_nc_gid=_1acSKT2OTgH8ZQ0bJ6aUA&amp;edm=APs17CUBAAAA&amp;ccb=7-5&amp;ig_cache_key=MzY5ODkzMzE3MTExNjA2MjI0MQ%3D%3D.3-ccb7-5&amp;oh=00_AfXk0ikDC415nmp9lsVp9ygKue8RqMwQeyMEVzuWYMQPDg&amp;oe=68A64902&amp;_nc_sid=10d13b" style="object-fit: cover;">
    ```
    There will be 3 <li> elements at first image
    ```html
    <li style="transform: translateX(1799px); width: 1px;"></li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(0px);">...(contains first image)...</li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(450px);">...(contains second image)...</li>
    ```
    Now we get first image URL
  - Step 1-1: You can find a button element before the <ul> element like this
    ```html
    <button aria-label="Next" class=" _afxw _al46 _al47" tabindex="-1"><div class=" _9zm2"></div></button>
    ```
    We have to click the button to get next image displayed, and we wait 1000ms for every single click to ensure html element is updated.
  - Step 2: We're at the second image by clicking the button. Now the <li> element will be like this
    ```html
    <li style="transform: translateX(1799px); width: 1px;"></li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(0px);">...(contains first image)...</li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(450px);">...(contains second image)...</li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(900px);">...(contains third image)...</li>
    ```
    Now we get second image URL
  - Step 3: We're at the third image by clicking the button. Now the <li> element will be like this
    ```html
    <li style="transform: translateX(1799px); width: 1px;"></li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(450px);">...(contains second image)...</li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(900px);">...(contains third image)...</li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(1350px);">..(contains fourth image)...</li>
    ```
    Now we get third image URL
  - Step 4: We're at the fourth image by clicking the button. Now the <li> element will be like this
    ```html
    <li style="transform: translateX(1799px); width: 1px;"></li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(900px);">...(contains third image)...</li>
    <li class="_acaz" tabindex="-1" style="transform: translateX(1350px);">..(contains fourth image)...</li>
    Now we get fourth image URL
- As you can see, the carousel will display between 2 and 3 images at a time.
- This is a example post with 4 images, but in reality, a post may contain more.
- Please get image from above the boundary, the boundary is a text like this:
    ```html
    More posts from
    ```
- Please do not use garbled class names or dynamic attributes as crawling logic, as it will change with each article.
